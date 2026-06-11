import Anthropic from "@anthropic-ai/sdk";
import {
  findInvoiceByNumber,
  getBusinessById,
  getBusinessForTelegramUser,
  getBusinessForWhatsAppUser,
  getExpenseSummary,
  getNextInvoiceNumber,
  getOutstandingBalance,
  linkTelegramAccount,
  linkWhatsAppAccount,
  listExpenses,
  listInvoices,
  recordPayment,
  saveExpense,
  saveInvoice,
  updateInvoiceStripeData,
  writeAuditLog,
} from "../db/queries";
import { createCheckoutSession } from "../payments/stripe";
import { computeInvoiceTotalsFromItems, InvoiceTotals } from "../invoices/calc";
import { generateInvoicePdf } from "../invoices/generate";
import { extractExpenseFromImage, extractIntent, IntentResult } from "../llm/extract";
import { ExpenseFields, InvoiceFields, PaymentFields } from "../llm/tools";
import { claimState, getState, resetState, setState } from "./state";
import { BotChannel } from "./channel";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function formatConfirmation(fields: InvoiceFields, totals: InvoiceTotals): string {
  const itemLines = fields.items
    .map((item) => {
      const qty = item.quantity && item.quantity !== 1 ? ` ×${item.quantity}` : "";
      return `  • ${item.description}${qty}: ${formatCurrency(item.amount * (item.quantity ?? 1), fields.currency)}`;
    })
    .join("\n");

  const totalsLines =
    totals.vatRate > 0
      ? `Subtotal: ${formatCurrency(totals.subtotal, fields.currency)}\n` +
        `VAT (${totals.vatRate}%): ${formatCurrency(totals.tax, fields.currency)}\n` +
        `Total: ${formatCurrency(totals.total, fields.currency)}`
      : `Total: ${formatCurrency(totals.total, fields.currency)}`;

  return (
    `Here's what I've got:\n\n` +
    `Client: ${fields.client_name}\n` +
    `Items:\n${itemLines}\n\n` +
    totalsLines + "\n" +
    `Currency: ${fields.currency}\n` +
    `Due date: ${fields.due_date ?? "(not set)"}\n\n` +
    `Reply yes to create this invoice, or send a new message to start over.`
  );
}

function formatPaymentConfirmation(payment: PaymentFields): string {
  const methodLabel: Record<string, string> = {
    transfer: "Bank transfer", cash: "Cash", card: "Card", other: "Other",
  };
  return (
    `Recording payment:\n\n` +
    `Invoice: ${payment.invoice_number}\n` +
    `Amount: ${formatCurrency(payment.amount, "GBP")}\n` +
    `Method: ${methodLabel[payment.method] ?? payment.method}` +
    (payment.reference ? `\nReference: ${payment.reference}` : "") +
    `\n\nReply yes to confirm, or send a new message to cancel.`
  );
}

function formatExpenseConfirmation(expense: ExpenseFields): string {
  return (
    `Here's what I read from the receipt:\n\n` +
    `Vendor: ${expense.vendor}\n` +
    `Amount: ${formatCurrency(expense.amount, expense.currency)}\n` +
    `Category: ${expense.category ?? "(not set)"}\n` +
    `Description: ${expense.description ?? "(not set)"}\n` +
    `Date: ${expense.expense_date ?? "(not set)"}\n\n` +
    `Reply yes to record this expense, or send a new message to start over.`
  );
}

async function handleInvoiceConfirmation(
  channel: BotChannel,
  fields: InvoiceFields,
  totals: InvoiceTotals,
  businessId: string
): Promise<void> {
  await channel.sendTyping();
  const invoiceNumber = await getNextInvoiceNumber(businessId);
  const pdfBuffer = await generateInvoicePdf(fields, totals, invoiceNumber, businessId);
  const invoiceId = await saveInvoice({ businessId, fields, totals, invoiceNumber, pdfBuffer });
  const storagePath = `${businessId}/${invoiceId}.pdf`;

  await writeAuditLog({
    businessId,
    action: "invoice.created",
    entityType: "invoice",
    entityId: invoiceId,
    metadata: {
      invoiceNumber,
      client: fields.client_name,
      currency: fields.currency,
      subtotal: totals.subtotal,
      vatRate: totals.vatRate,
      tax: totals.tax,
      total: totals.total,
    },
  });

  let paymentUrl: string | null = null;
  try {
    const session = await createCheckoutSession({
      invoiceId,
      businessId,
      invoiceNumber,
      description: fields.items.map((i) => i.description).join(", "),
      amount: totals.total,
      currency: fields.currency,
    });
    await updateInvoiceStripeData(invoiceId, session.url, session.sessionId);
    paymentUrl = session.url;
  } catch (err) {
    console.error("Stripe checkout session failed (invoice still created):", err);
  }

  const caption = paymentUrl
    ? `Here's your invoice ${invoiceNumber}.\n\nShare this with your client — you'll be notified when they pay.`
    : `Here's your invoice ${invoiceNumber}. Ready to send!`;

  await channel.sendDocument(pdfBuffer, `${invoiceNumber}.pdf`, storagePath, caption, paymentUrl ?? undefined);
}

async function handlePaymentConfirmation(
  channel: BotChannel,
  payment: PaymentFields,
  invoiceId: string,
  invoiceTotal: number,
  businessId: string
): Promise<void> {
  const paymentId = await recordPayment({ businessId, invoiceId, invoiceTotal, payment });

  await writeAuditLog({
    businessId,
    action: "payment.recorded",
    entityType: "payment",
    entityId: paymentId,
    metadata: { invoiceNumber: payment.invoice_number, amount: payment.amount, method: payment.method },
  });

  const fullyPaid = payment.amount >= invoiceTotal;
  await channel.sendText(
    `Payment recorded for ${payment.invoice_number}.` +
    (fullyPaid ? " Invoice marked as paid." : "")
  );
}

async function handleExpenseConfirmation(
  channel: BotChannel,
  expense: ExpenseFields,
  imageBuffer: Buffer,
  mimeType: string,
  businessId: string
): Promise<void> {
  const expenseId = await saveExpense({ businessId, expense, imageBuffer, mimeType });

  await writeAuditLog({
    businessId,
    action: "expense.recorded",
    entityType: "expense",
    entityId: expenseId,
    metadata: { vendor: expense.vendor, amount: expense.amount, currency: expense.currency, category: expense.category },
  });

  await channel.sendText(`Expense recorded: ${formatCurrency(expense.amount, expense.currency)} at ${expense.vendor}.`);
}

/**
 * Entry point for a photographed receipt — runs vision extraction and, if a
 * usable vendor + amount were read, asks the user to confirm before recording.
 * Never records on a guess: an unreadable receipt gets a request to retake it.
 */
export async function handleReceiptImage(
  channel: BotChannel,
  imageBuffer: Buffer,
  mimeType: string,
  channelType: "telegram" | "whatsapp" = "telegram"
): Promise<void> {
  const userId = channel.userId;

  const businessId = channelType === "whatsapp"
    ? await getBusinessForWhatsAppUser(userId)
    : await getBusinessForTelegramUser(Number(userId));

  if (!businessId) {
    await channel.sendText("Your account isn't linked to a business yet. Please set up your account first.");
    return;
  }

  await channel.sendTyping();
  const expense = await extractExpenseFromImage(imageBuffer, mimeType, anthropic);

  if (!expense) {
    await channel.sendText("I couldn't make out the vendor and amount on that receipt. Could you send a clearer photo?");
    return;
  }

  await setState(userId, {
    stage: "awaiting_expense_confirmation",
    expense,
    imageBufferB64: imageBuffer.toString("base64"),
    mimeType,
  });
  await channel.sendText(formatExpenseConfirmation(expense));
}

/**
 * Resolve a user's due-date reply to a YYYY-MM-DD string.
 * Tries simple patterns first to avoid an extra LLM call; falls back to
 * extractIntent only for complex expressions the patterns can't cover.
 */
async function resolveDueDate(
  text: string,
  anthropic: Anthropic
): Promise<string | null> {
  const trimmed = text.trim();

  // ISO date already
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed;
  }

  // "in N days/weeks"
  const inMatch = trimmed.match(/^in\s+(\d+)\s+(day|days|week|weeks)$/i);
  if (inMatch) {
    const n = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase().startsWith("w") ? n * 7 : n;
    const d = new Date();
    d.setDate(d.getDate() + unit);
    return d.toISOString().split("T")[0];
  }

  // Month name + day, e.g. "30 June", "June 30", "30 Jun"
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  // Fall back to LLM for complex cases ("end of month", "next Friday", etc.)
  try {
    const { extractIntent } = await import("../llm/extract");
    const result = await extractIntent(`due date: ${trimmed}`, anthropic, "GBP");
    if (result.intent === "create_invoice" && result.data.due_date) {
      return result.data.due_date;
    }
  } catch {
    // ignore
  }

  return null;
}

export async function handleBotMessage(channel: BotChannel, text: string, channelType: "telegram" | "whatsapp" = "telegram"): Promise<void> {
  const userId = channel.userId;

  // ── Global cancel — must come before connect-code check ─────────────────
  if (/^(cancel|stop|start over|reset|nevermind|never mind)$/i.test(text.trim())) {
    await resetState(userId);
    await channel.sendText("No problem — cancelled. Send me a new request whenever you're ready.");
    return;
  }

  // ── Connect code — always intercept before state checks ──────────────────
  if (/^[A-Z0-9]{6}$/i.test(text.trim())) {
    const linked = channelType === "whatsapp"
      ? await linkWhatsAppAccount(text.trim(), userId)
      : await linkTelegramAccount(text.trim(), Number(userId));

    if (linked) {
      await resetState(userId);
      await channel.sendText(
        "Your account is now linked to your business! You're ready to go.\n\nTry: \"Generate an invoice for ABC Company for £500 consulting services\""
      );
    } else {
      await channel.sendText(
        "That code didn't work — it may have expired (codes last 15 minutes) or been entered incorrectly.\n\nGo back to the dashboard and click Continue to get a fresh code."
      );
    }
    return;
  }

  const current = await getState(userId);

  // ── Due-date collection ──────────────────────────────────────────────────
  if (current.stage === "awaiting_due_date") {
    await channel.sendTyping();
    const resolvedDate = await resolveDueDate(text, anthropic);
    if (!resolvedDate) {
      await channel.sendText("Sorry, I couldn't parse that date. Please try again, e.g. '30 June', 'in 14 days', or '2026-06-30'.\n\nOr type 'cancel' to start over.");
      return;
    }
    const updatedFields = { ...current.fields, due_date: resolvedDate };
    const totals = computeInvoiceTotalsFromItems(updatedFields.items, current.businessVatRate);
    await setState(userId, { stage: "awaiting_confirmation", fields: updatedFields, totals });
    await channel.sendText(formatConfirmation(updatedFields, totals));
    return;
  }

  // ── Confirmation stages ──────────────────────────────────────────────────
  if (
    current.stage === "awaiting_confirmation" ||
    current.stage === "awaiting_payment_confirmation" ||
    current.stage === "awaiting_expense_confirmation"
  ) {
    const isYes = /^yes$/i.test(text) || /^confirm$/i.test(text);
    if (!isYes) {
      await resetState(userId);
      await channel.sendText("No problem. Send me a new request whenever you're ready.");
      return;
    }

    // Atomically take the pending action — a duplicate "yes" finds nothing.
    const claimed = await claimState(userId);
    if (claimed.stage === "idle") return; // already handled

    const businessId = channelType === "whatsapp"
      ? await getBusinessForWhatsAppUser(userId)
      : await getBusinessForTelegramUser(Number(userId));

    if (!businessId) {
      await channel.sendText("Your account isn't linked to a business yet. Please set up your account first.");
      return;
    }

    if (claimed.stage === "awaiting_confirmation") {
      await handleInvoiceConfirmation(channel, claimed.fields, claimed.totals, businessId);
    } else if (claimed.stage === "awaiting_payment_confirmation") {
      const invoice = await findInvoiceByNumber(businessId, claimed.payment.invoice_number);
      await handlePaymentConfirmation(channel, claimed.payment, claimed.invoiceId, invoice?.total ?? claimed.payment.amount, businessId);
    } else if (claimed.stage === "awaiting_expense_confirmation") {
      const imageBuffer = Buffer.from(claimed.imageBufferB64, "base64");
      await handleExpenseConfirmation(channel, claimed.expense, imageBuffer, claimed.mimeType, businessId);
    }
    return;
  }

  // ── Idle: extract intent ─────────────────────────────────────────────────

  const businessId = channelType === "whatsapp"
    ? await getBusinessForWhatsAppUser(userId)
    : await getBusinessForTelegramUser(Number(userId));

  const business = businessId ? await getBusinessById(businessId) : null;

  await channel.sendTyping();
  let result: IntentResult;
  try {
    result = await extractIntent(text, anthropic, business?.currency ?? "GBP");
  } catch (err) {
    console.error("extractIntent failed:", err);
    await channel.sendText("Sorry — something went wrong on my side. Please try again in a moment.");
    return;
  }

  switch (result.intent) {
    case "question":
      await channel.sendText(result.text);
      break;

    case "create_invoice": {
      const { data } = result;
      if (!data.items?.length || data.items.some((i) => !Number.isFinite(i.amount) || i.amount <= 0)) {
        await channel.sendText("I couldn't confirm the invoice amount(s). Could you provide clear numbers?");
        return;
      }
      const businessVatRate = data.vat_rate ?? business?.vat_rate ?? 0;
      if (!data.due_date) {
        await setState(userId, { stage: "awaiting_due_date", fields: data, businessVatRate });
        await channel.sendText("When is this invoice due? (e.g. 30 June, in 14 days, end of month)");
        return;
      }
      const totals = computeInvoiceTotalsFromItems(data.items, businessVatRate);
      await setState(userId, { stage: "awaiting_confirmation", fields: data, totals });
      await channel.sendText(formatConfirmation(data, totals));
      break;
    }

    case "record_payment": {
      if (!businessId) {
        await channel.sendText("Your account isn't linked to a business yet.");
        return;
      }
      const { data } = result;
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        await channel.sendText("I couldn't confirm the payment amount. Could you clarify?");
        return;
      }
      const invoice = await findInvoiceByNumber(businessId, data.invoice_number);
      if (!invoice) {
        await channel.sendText(`I couldn't find invoice ${data.invoice_number}. Please check the number and try again.`);
        return;
      }
      await setState(userId, { stage: "awaiting_payment_confirmation", payment: data, invoiceId: invoice.id });
      await channel.sendText(formatPaymentConfirmation(data));
      break;
    }

    case "list_invoices": {
      if (!businessId) {
        await channel.sendText("Your account isn't linked to a business yet.");
        return;
      }
      const invoices = await listInvoices(businessId, result.status);
      if (invoices.length === 0) {
        await channel.sendText(result.status ? `No ${result.status} invoices found.` : "No invoices found yet.");
        return;
      }
      const statusLabel: Record<string, string> = {
        draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled",
      };
      const lines = invoices.map(
        (inv) =>
          `${inv.invoice_number} — ${inv.client_name} — ${formatCurrency(inv.total, inv.currency)} — ${statusLabel[inv.status] ?? inv.status}`
      );
      await channel.sendText(`Your invoices:\n\n${lines.join("\n")}\n\n${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} shown.`);
      break;
    }

    case "get_balance": {
      if (!businessId) {
        await channel.sendText("Your account isn't linked to a business yet.");
        return;
      }
      const { outstanding, currency, count } = await getOutstandingBalance(businessId);
      if (count === 0) {
        await channel.sendText("No outstanding invoices. You're all caught up!");
      } else {
        await channel.sendText(
          `Outstanding balance: ${formatCurrency(outstanding, currency)}\n(${count} unpaid invoice${count !== 1 ? "s" : ""})`
        );
      }
      break;
    }

    case "list_expenses": {
      if (!businessId) {
        await channel.sendText("Your account isn't linked to a business yet.");
        return;
      }
      const expenses = await listExpenses(businessId, result.category);
      if (expenses.length === 0) {
        await channel.sendText(result.category ? `No ${result.category} expenses found.` : "No expenses recorded yet. Send me a photo of a receipt to log one.");
        return;
      }
      const lines = expenses.map(
        (exp) =>
          `${exp.expense_date} — ${exp.vendor} — ${formatCurrency(exp.amount, exp.currency)}` +
          (exp.category ? ` — ${exp.category}` : "")
      );
      await channel.sendText(`Your expenses:\n\n${lines.join("\n")}\n\n${expenses.length} expense${expenses.length !== 1 ? "s" : ""} shown.`);
      break;
    }

    case "get_expense_summary": {
      if (!businessId) {
        await channel.sendText("Your account isn't linked to a business yet.");
        return;
      }
      const summaries = await getExpenseSummary(businessId);
      if (summaries.length === 0) {
        await channel.sendText("No expenses recorded this month.");
      } else {
        const lines = summaries.map(
          (s) => `${formatCurrency(s.total, s.currency)} across ${s.count} expense${s.count !== 1 ? "s" : ""}`
        );
        await channel.sendText(`This month's spending:\n\n${lines.join("\n")}`);
      }
      break;
    }
  }
}
