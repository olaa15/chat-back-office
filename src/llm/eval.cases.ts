import { IntentResult } from "./extract";

/**
 * Labelled real-phrasing test set for the extraction step (CLAUDE.md:
 * "Add a small labelled test set of real phrasings ... re-run it after
 * any prompt change to catch regressions"). Each case names the behaviour
 * it pins down; `check` returns null on pass or a failure reason string.
 */
export interface EvalCase {
  label: string;
  message: string;
  defaultCurrency?: string;
  check: (result: IntentResult) => string | null;
}

function expectIntent<T extends IntentResult["intent"]>(
  result: IntentResult,
  intent: T
): (Extract<IntentResult, { intent: T }>) | string {
  if (result.intent !== intent) {
    return `expected intent "${intent}", got "${result.intent}"`;
  }
  return result as Extract<IntentResult, { intent: T }>;
}

export const evalCases: EvalCase[] = [
  {
    label: "create_invoice — full details with stated currency",
    message: "Generate an invoice for ABC Company for ₦250,000 consulting services",
    check: (r) => {
      const m = expectIntent(r, "create_invoice");
      if (typeof m === "string") return m;
      if (m.data.client_name.toLowerCase() !== "abc company") return `unexpected client_name "${m.data.client_name}"`;
      if (!m.data.items?.length) return "expected items array to be non-empty";
      if (m.data.items[0].amount !== 250000) return `expected items[0].amount 250000, got ${m.data.items[0].amount}`;
      if (m.data.currency !== "NGN") return `expected currency NGN, got ${m.data.currency}`;
      if (m.data.vat_rate !== undefined) return `expected no vat_rate, got ${m.data.vat_rate}`;
      return null;
    },
  },
  {
    label: "create_invoice — explicit VAT rate stated",
    message: "Invoice Jane Doe for £500 design work plus 20% VAT",
    check: (r) => {
      const m = expectIntent(r, "create_invoice");
      if (typeof m === "string") return m;
      if (!m.data.items?.length) return "expected items array to be non-empty";
      if (m.data.items[0].amount !== 500) return `expected items[0].amount 500, got ${m.data.items[0].amount}`;
      if (m.data.vat_rate !== 20) return `expected vat_rate 20, got ${m.data.vat_rate}`;
      return null;
    },
  },
  {
    label: "create_invoice — explicit VAT exemption (\"no VAT\")",
    message: "Bill Acme Ltd $1,200 for software development, no VAT",
    check: (r) => {
      const m = expectIntent(r, "create_invoice");
      if (typeof m === "string") return m;
      if (!m.data.items?.length) return "expected items array to be non-empty";
      if (m.data.items[0].amount !== 1200) return `expected items[0].amount 1200, got ${m.data.items[0].amount}`;
      if (m.data.vat_rate !== 0) return `expected vat_rate 0 (explicit exemption), got ${m.data.vat_rate}`;
      return null;
    },
  },
  {
    label: "create_invoice — currency omitted, falls back to business default",
    message: "Invoice Acme Ltd for 800 for July retainer",
    defaultCurrency: "EUR",
    check: (r) => {
      const m = expectIntent(r, "create_invoice");
      if (typeof m === "string") return m;
      if (m.data.currency !== "EUR") return `expected fallback currency EUR, got ${m.data.currency}`;
      return null;
    },
  },
  {
    label: "create_invoice — two items extracted as separate line items",
    message: "Invoice Sara £200 for design and £50 for hosting",
    check: (r) => {
      const m = expectIntent(r, "create_invoice");
      if (typeof m === "string") return m;
      if (m.data.items.length < 2) return `expected at least 2 items, got ${m.data.items.length}`;
      const amounts = m.data.items.map((i) => i.amount).sort((a, b) => a - b);
      if (!amounts.includes(50)) return `expected an item with amount 50, got [${amounts}]`;
      if (!amounts.includes(200)) return `expected an item with amount 200, got [${amounts}]`;
      return null;
    },
  },
  {
    label: "create_invoice — missing amount triggers a question, not a guess",
    message: "Create an invoice for Bob's Burgers for catering services",
    check: (r) => {
      if (r.intent !== "question") return `expected a clarifying question when amount is missing, got intent "${r.intent}"`;
      return null;
    },
  },
  {
    label: "create_invoice — missing client name triggers a question, not a guess",
    message: "Generate an invoice for £300 consulting work",
    check: (r) => {
      if (r.intent !== "question") return `expected a clarifying question when client is missing, got intent "${r.intent}"`;
      return null;
    },
  },
  {
    label: "record_payment — full details",
    message: "Mark invoice INV-0007 as paid, received £200 via bank transfer",
    check: (r) => {
      const m = expectIntent(r, "record_payment");
      if (typeof m === "string") return m;
      if (m.data.invoice_number.toUpperCase() !== "INV-0007") return `unexpected invoice_number "${m.data.invoice_number}"`;
      if (m.data.amount !== 200) return `expected amount 200, got ${m.data.amount}`;
      return null;
    },
  },
  {
    label: "record_payment — missing amount triggers a question, not a guess",
    message: "Record a payment for INV-0003",
    check: (r) => {
      if (r.intent !== "question") return `expected a clarifying question when payment amount is missing, got intent "${r.intent}"`;
      return null;
    },
  },
  {
    label: "list_invoices — filtered by status",
    message: "Show me my unpaid invoices",
    check: (r) => {
      const m = expectIntent(r, "list_invoices");
      if (typeof m === "string") return m;
      // The tool's status vocabulary is draft/sent/paid/overdue/cancelled — there's
      // no literal "unpaid", so "sent" or "overdue" are the correct mappings for it.
      if (!m.status || !/^(sent|overdue)$/i.test(m.status)) {
        return `expected status "sent" or "overdue" for an "unpaid" filter, got "${m.status}"`;
      }
      return null;
    },
  },
  {
    label: "get_balance — plain question",
    message: "What's my outstanding balance right now?",
    check: (r) => {
      const m = expectIntent(r, "get_balance");
      return typeof m === "string" ? m : null;
    },
  },
  {
    label: "expense described in text — redirected to receipt photo, not recorded blind",
    message: "I spent £45 on office supplies yesterday",
    check: (r) => {
      if (r.intent !== "question") return `expected a redirect-to-photo response, got intent "${r.intent}"`;
      if (!/photo|picture|image|receipt/i.test(r.text)) {
        return `expected the reply to mention sending a photo/receipt, got: "${r.text}"`;
      }
      return null;
    },
  },
  {
    label: "get_expense_summary — plain question",
    message: "How much have I spent this month?",
    check: (r) => {
      const m = expectIntent(r, "get_expense_summary");
      return typeof m === "string" ? m : null;
    },
  },
];
