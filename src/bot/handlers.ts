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
import { computeInvoiceTotals, InvoiceTotals } from "../invoices/calc";
import { generateInvoicePdf } from "../invoices/generate";
import { extractExpenseFromImage, extractIntent } from "../llm/extract";
import { ExpenseFields, InvoiceFields, PaymentFields } from "../llm/tools";
import { getState, resetState, setState } from "./state";
import { BotChannel } from "./channel";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function formatConfirmation(fields: InvoiceFields, totals: InvoiceTotals): string {
  const amountLines = totals.vatRate > 0
    ? `Amount: ${formatCurrency(totals.subtotal, fields.currency)}\n` +
      `VAT (${totals.vatRate}%): ${formatCurrency(totals.tax, fields.currency)}\n` +
      `Total: ${formatCurrency(totals.total, fields.currency)}\n`
    : `Amount: ${formatCurrency(totals.subtotal, fields.currency)}\n`;

  return (
    `Here's what I've got:\n\n` +
    `Client: ${fields.client_name}\n` +
    amountLines +
    `Description: ${fields.description}\n` +
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
      description: fields.description,
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

  setState(userId, { stage: "awaiting_expense_confirmation", expense, imageBuffer, mimeType });
  await channel.sendText(formatExpenseConfirmation(expense));
}

export async function handleBotMessage(channel: BotChannel, text: string, channelType: "telegram" | "whatsapp" = "telegram"): Promise<void> {
  const userId = channel.userId;
  const current = getState(userId);

  // ── Confirmation stages ──────────────────────────────────────────────────
  if (
    current.stage === "awaiting_confirmation" ||
    current.stage === "awaiting_payment_confirmation" ||
    current.stage === "awaiting_expense_confirmation"
  ) {
    const isYes = /^yes$/i.test(text) || /^confirm$/i.test(text);

    if (!isYes) {
      resetState(userId);
      await channel.sendText("No problem. Send me a new request whenever you're ready.");
      return;
    }

    const businessId = channelType === "whatsapp"
      ? await getBusinessForWhatsAppUser(userId)
      : await getBusinessForTelegramUser(Number(userId));

    if (!businessId) {
      await channel.sendText("Your account isn't linked to a business yet. Please set up your account first.");
      return;
    }

    if (current.stage === "awaiting_confirmation") {
      const { fields, totals } = current;
      resetState(userId);
      await handleInvoiceConfirmation(channel, fields, totals, businessId);
    } else if (current.stage === "awaiting_payment_confirmation") {
      const { payment, invoiceId } = current;
      const invoice = await findInvoiceByNumber(businessId, payment.invoice_number);
      resetState(userId);
      await handlePaymentConfirmation(channel, payment, invoiceId, invoice?.total ?? payment.amount, businessId);
    } else {
      const { expense, imageBuffer, mimeType } = current;
      resetState(userId);
      await handleExpenseConfirmation(channel, expense, imageBuffer, mimeType, businessId);
    }
    return;
  }

  // ── Idle: extract intent ─────────────────────────────────────────────────

  // Intercept onboarding connect codes (6 alphanumeric chars) before Claude
  if (/^[A-Z0-9]{6}$/i.test(text)) {
    const linked = channelType === "whatsapp"
      ? await linkWhatsAppAccount(text, userId)
      : await linkTelegramAccount(text, Number(userId));

    if (linked) {
      await channel.sendText(
        "Your account is now linked to your business! You're ready to go.\n\nTry: \"Generate an invoice for ABC Company for £500 consulting services\""
      );
      return;
    }
  }

  const businessId = channelType === "whatsapp"
    ? await getBusinessForWhatsAppUser(userId)
    : await getBusinessForTelegramUser(Number(userId));

  const business = businessId ? await getBusinessById(businessId) : null;

  await channel.sendTyping();
  const result = await extractIntent(text, anthropic, business?.currency ?? "GBP");

  switch (result.intent) {
    case "question":
      await channel.sendText(result.text);
      break;

    case "create_invoice": {
      const { data } = result;
      if (!Number.isFinite(data.amount) || data.amount <= 0) {
        await channel.sendText("I couldn't confirm the invoice amount. Could you provide a clear number?");
        return;
      }
      const totals = computeInvoiceTotals(data.amount, data.vat_rate ?? business?.vat_rate ?? 0);
      setState(userId, { stage: "awaiting_confirmation", fields: data, totals });
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
      setState(userId, { stage: "awaiting_payment_confirmation", payment: data, invoiceId: invoice.id });
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
