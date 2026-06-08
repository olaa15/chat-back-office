import Anthropic from "@anthropic-ai/sdk";

export interface InvoiceFields {
  client_name: string;
  amount: number;
  currency: string;
  description: string;
  due_date?: string;
  vat_rate?: number;
}

export interface PaymentFields {
  invoice_number: string;
  amount: number;
  method: string;
  reference?: string;
}

export const createInvoiceTool: Anthropic.Tool = {
  name: "create_invoice",
  description: "Extract invoice fields from a user's natural-language request to create an invoice.",
  input_schema: {
    type: "object" as const,
    properties: {
      client_name: { type: "string", description: "Name of the client to invoice" },
      amount:      { type: "number", description: "Invoice amount as a positive number — never invent this" },
      currency:    { type: "string", description: "ISO currency code, ONLY if the user states or implies one (a symbol like ₦/$/€/£ counts). Omit entirely if not stated — the system applies the business's default currency." },
      description: { type: "string", description: "Description of the service or product" },
      due_date:    { type: "string", description: "Due date as ISO date string YYYY-MM-DD (optional)" },
      vat_rate:    { type: "number", description: "VAT/tax rate as a percentage, ONLY if the user explicitly states one (e.g. 'plus 20% VAT' → 20, 'no VAT' / 'VAT exempt' → 0, '+5% tax' → 5). Omit entirely if VAT/tax isn't mentioned — the system applies the business's default rate. Never guess a rate." },
    },
    required: ["client_name", "amount", "description"],
  },
};

export const recordPaymentTool: Anthropic.Tool = {
  name: "record_payment",
  description: "Record a payment received against an existing invoice.",
  input_schema: {
    type: "object" as const,
    properties: {
      invoice_number: { type: "string", description: "Invoice number, e.g. INV-0001" },
      amount:         { type: "number", description: "Payment amount — never invent or guess this" },
      method:         { type: "string", description: "Payment method: transfer, cash, card, or other. Default: transfer" },
      reference:      { type: "string", description: "Optional payment reference or transaction ID" },
    },
    required: ["invoice_number", "amount"],
  },
};

export const listInvoicesTool: Anthropic.Tool = {
  name: "list_invoices",
  description: "List the business's invoices, optionally filtered by status.",
  input_schema: {
    type: "object" as const,
    properties: {
      status: { type: "string", description: "Optional status filter: draft, sent, paid, overdue, or cancelled" },
    },
    required: [],
  },
};

export const getBalanceTool: Anthropic.Tool = {
  name: "get_balance",
  description: "Get the total outstanding (unpaid) balance across all sent and overdue invoices.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

export interface ExpenseFields {
  vendor: string;
  amount: number;
  currency: string;
  category?: string;
  description?: string;
  expense_date?: string;
}

export const recordExpenseTool: Anthropic.Tool = {
  name: "record_expense",
  description: "Extract expense details from a photographed receipt. Read every field directly off the receipt — never invent or estimate the amount.",
  input_schema: {
    type: "object" as const,
    properties: {
      vendor:       { type: "string", description: "Name of the vendor/merchant printed on the receipt" },
      amount:       { type: "number", description: "Total amount paid, exactly as shown on the receipt — never invent or guess this" },
      currency:     { type: "string", description: "ISO currency code as shown on the receipt, default GBP" },
      category:     { type: "string", description: "Best-guess expense category, e.g. travel, meals, supplies, software, utilities" },
      description:  { type: "string", description: "Brief description of what was purchased" },
      expense_date: { type: "string", description: "Date on the receipt as ISO date YYYY-MM-DD, if visible" },
    },
    required: ["vendor", "amount"],
  },
};

export const listExpensesTool: Anthropic.Tool = {
  name: "list_expenses",
  description: "List the business's recorded expenses, optionally filtered by category.",
  input_schema: {
    type: "object" as const,
    properties: {
      category: { type: "string", description: "Optional category filter, e.g. travel, meals, supplies" },
    },
    required: [],
  },
};

export const getExpenseSummaryTool: Anthropic.Tool = {
  name: "get_expense_summary",
  description: "Get a summary of how much the business has spent this month, totalled by currency.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};
