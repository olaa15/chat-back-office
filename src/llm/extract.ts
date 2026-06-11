import Anthropic from "@anthropic-ai/sdk";
import {
  createInvoiceTool,
  ExpenseFields,
  getBalanceTool,
  getExpenseSummaryTool,
  InvoiceFields,
  InvoiceLineItem,
  listExpensesTool,
  listInvoicesTool,
  PaymentFields,
  recordExpenseTool,
  recordPaymentTool,
} from "./tools";

export type IntentResult =
  | { intent: "create_invoice"; data: InvoiceFields }
  | { intent: "record_payment"; data: PaymentFields }
  | { intent: "list_invoices"; status?: string }
  | { intent: "get_balance" }
  | { intent: "list_expenses"; category?: string }
  | { intent: "get_expense_summary" }
  | { intent: "question"; text: string };

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0];
  return `Today is ${today}.

You are a back-office assistant that helps business owners manage their invoices, payments, and expenses.

You have these tools available:
- create_invoice: when the user wants to create or generate a new invoice
- record_payment: when the user wants to mark an invoice as paid or record a payment received
- list_invoices: when the user wants to see their invoices (optionally filtered by status)
- get_balance: when the user wants to know their outstanding balance or how much they're owed
- list_expenses: when the user wants to see their recorded expenses (optionally filtered by category)
- get_expense_summary: when the user wants to know how much they've spent this month

Rules:
- NEVER invent or guess an amount for create_invoice or record_payment. If the amount is missing, ask for it.
- For create_invoice: if client_name is missing, ask — do not call the tool.
- Capture each distinct service or product as its own item in the items array with its own price. If the user gives one lump sum for a single service, that is one item.
- Resolve relative due dates ('in 7 days', 'end of month', 'next Friday') to a concrete YYYY-MM-DD using today's date. Do not leave relative expressions in due_date.
- For record_payment: if invoice_number is missing, ask which invoice. If amount is missing, ask.
- Only set currency or vat_rate on create_invoice if the user explicitly states them — never invent either. The system applies sensible business defaults when they're omitted.
- For list_invoices, get_balance, list_expenses, and get_expense_summary, call the tool immediately — no missing fields needed.
- Expenses are recorded by photographing a receipt, not by typing — if the user describes a purchase in text, tell them to send a photo of the receipt instead.
- Keep follow-up questions short and friendly.`;
}

const ALL_TOOLS = [
  createInvoiceTool,
  recordPaymentTool,
  listInvoicesTool,
  getBalanceTool,
  listExpensesTool,
  getExpenseSummaryTool,
];

export async function extractIntent(
  userMessage: string,
  anthropic: Anthropic,
  defaultCurrency = "GBP"
): Promise<IntentResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: buildSystemPrompt(),
    tools: ALL_TOOLS,
    messages: [{ role: "user", content: userMessage }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");

  if (toolBlock && toolBlock.type === "tool_use") {
    const raw = toolBlock.input as Record<string, unknown>;

    switch (toolBlock.name) {
      case "create_invoice": {
        let items: InvoiceLineItem[] = [];
        if (Array.isArray(raw.items)) {
          items = (raw.items as Record<string, unknown>[]).map((i) => ({
            description: String(i.description),
            amount: Number(i.amount),
            quantity: i.quantity != null ? Number(i.quantity) : undefined,
          }));
        } else if (raw.amount !== undefined && raw.description !== undefined) {
          // Legacy single-item fallback
          items = [{ description: String(raw.description), amount: Number(raw.amount) }];
        }
        return {
          intent: "create_invoice",
          data: {
            client_name: String(raw.client_name),
            items,
            currency: raw.currency ? String(raw.currency) : defaultCurrency,
            due_date: raw.due_date ? String(raw.due_date) : undefined,
            vat_rate: raw.vat_rate !== undefined && raw.vat_rate !== null ? Number(raw.vat_rate) : undefined,
          },
        };
      }

      case "record_payment":
        return {
          intent: "record_payment",
          data: {
            invoice_number: String(raw.invoice_number),
            amount: Number(raw.amount),
            method: raw.method ? String(raw.method) : "transfer",
            reference: raw.reference ? String(raw.reference) : undefined,
          },
        };

      case "list_invoices":
        return {
          intent: "list_invoices",
          status: raw.status ? String(raw.status) : undefined,
        };

      case "get_balance":
        return { intent: "get_balance" };

      case "list_expenses":
        return {
          intent: "list_expenses",
          category: raw.category ? String(raw.category) : undefined,
        };

      case "get_expense_summary":
        return { intent: "get_expense_summary" };
    }
  }

  const textBlock = response.content.find((b) => b.type === "text");
  const text =
    textBlock && textBlock.type === "text"
      ? textBlock.text
      : "Could you give me more details?";

  return { intent: "question", text };
}

const RECEIPT_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ReceiptMediaType = (typeof RECEIPT_MEDIA_TYPES)[number];

function toReceiptMediaType(mimeType: string): ReceiptMediaType {
  return (RECEIPT_MEDIA_TYPES as readonly string[]).includes(mimeType)
    ? (mimeType as ReceiptMediaType)
    : "image/jpeg";
}

/**
 * Reads a photographed receipt and extracts expense fields. Returns null if
 * Claude can't make out a vendor and amount — code then asks for a clearer
 * photo rather than recording a guessed figure.
 */
export async function extractExpenseFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  anthropic: Anthropic
): Promise<ExpenseFields | null> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    tools: [recordExpenseTool],
    tool_choice: { type: "tool", name: "record_expense" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: toReceiptMediaType(mimeType),
              data: imageBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "This is a photo of a receipt. Extract the expense details with the record_expense tool. Read the amount and vendor directly off the receipt — never invent or estimate them.",
          },
        ],
      },
    ],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") return null;

  const raw = toolBlock.input as Record<string, unknown>;
  const amount = Number(raw.amount);
  if (!raw.vendor || !Number.isFinite(amount) || amount <= 0) return null;

  return {
    vendor: String(raw.vendor),
    amount,
    currency: raw.currency ? String(raw.currency) : "GBP",
    category: raw.category ? String(raw.category) : undefined,
    description: raw.description ? String(raw.description) : undefined,
    expense_date: raw.expense_date ? String(raw.expense_date) : undefined,
  };
}
