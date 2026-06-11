import { supabase } from "../db/client";
import { InvoiceTotals } from "../invoices/calc";
import { ExpenseFields, InvoiceFields, PaymentFields } from "../llm/tools";

export type ConversationState =
  | { stage: "idle" }
  | { stage: "awaiting_confirmation"; fields: InvoiceFields; totals: InvoiceTotals }
  | { stage: "awaiting_due_date"; fields: InvoiceFields; businessVatRate: number }
  | { stage: "awaiting_payment_confirmation"; payment: PaymentFields; invoiceId: string }
  | { stage: "awaiting_expense_confirmation"; expense: ExpenseFields; imageBufferB64: string; mimeType: string };

const IDLE: ConversationState = { stage: "idle" };

// Conversation state lives in Supabase (`conversation_state`) rather than an
// in-memory Map, so an in-flight "awaiting confirmation" survives a restart
// and works across multiple bot instances. Each row carries its own expiry —
// a stale confirmation a user never answers shouldn't linger indefinitely.
// The expense image is held as base64 (jsonb can't store a Buffer); receipts
// are small and state is short-lived, so this is fine — no wrapper needed.
const STATE_TTL_MINUTES = 30;

export async function getState(chatId: string): Promise<ConversationState> {
  const { data, error } = await supabase
    .from("conversation_state")
    .select("state, expires_at")
    .eq("user_key", chatId)
    .maybeSingle();

  if (error || !data) return IDLE;
  if (new Date(data.expires_at as string) < new Date()) {
    await resetState(chatId);
    return IDLE;
  }

  return data.state as ConversationState;
}

export async function setState(chatId: string, s: ConversationState): Promise<void> {
  const expiresAt = new Date(Date.now() + STATE_TTL_MINUTES * 60_000).toISOString();
  await supabase.from("conversation_state").upsert({
    user_key: chatId,
    state: s,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
}

export async function resetState(chatId: string): Promise<void> {
  await supabase.from("conversation_state").delete().eq("user_key", chatId);
}

/**
 * Atomically take and remove the state. The first concurrent caller gets the
 * row; any second "yes" arriving at the same time finds nothing and returns
 * idle — which is what makes the confirmation step idempotent (no double
 * invoice from a duplicated/retried message).
 */
export async function claimState(chatId: string): Promise<ConversationState> {
  const { data } = await supabase
    .from("conversation_state")
    .delete()
    .eq("user_key", chatId)
    .select("state, expires_at")
    .maybeSingle();

  if (!data) return IDLE;
  if (new Date(data.expires_at as string) < new Date()) return IDLE;
  return data.state as ConversationState;
}
