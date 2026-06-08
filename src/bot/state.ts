import { InvoiceTotals } from "../invoices/calc";
import { ExpenseFields, InvoiceFields, PaymentFields } from "../llm/tools";

type ConversationState =
  | { stage: "idle" }
  | { stage: "awaiting_confirmation"; fields: InvoiceFields; totals: InvoiceTotals }
  | { stage: "awaiting_payment_confirmation"; payment: PaymentFields; invoiceId: string }
  | { stage: "awaiting_expense_confirmation"; expense: ExpenseFields; imageBuffer: Buffer; mimeType: string };

const state = new Map<string, ConversationState>();

export function getState(chatId: string): ConversationState {
  return state.get(chatId) ?? { stage: "idle" };
}

export function setState(chatId: string, s: ConversationState): void {
  state.set(chatId, s);
}

export function resetState(chatId: string): void {
  state.set(chatId, { stage: "idle" });
}
