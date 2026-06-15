import { supabase } from "../db/client";

/**
 * Claim an inbound provider message id the first time it is seen.
 * Returns true if this is the first delivery (process it), or false if it's a
 * re-delivery (a Telegram/WhatsApp webhook retry) that must be skipped.
 *
 * The (channel, message_id) primary key is the lock: a duplicate insert raises
 * Postgres unique-violation 23505, which we read as "already processed".
 */
export async function claimMessage(channel: string, messageId: string): Promise<boolean> {
  const { error } = await supabase
    .from("processed_messages")
    .insert({ channel, message_id: messageId });

  if (!error) return true; // first time we've seen this delivery
  if (error.code === "23505") return false; // duplicate delivery — skip it
  throw error; // a real error — surface it (the platform will retry)
}
