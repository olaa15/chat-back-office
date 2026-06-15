import "dotenv/config";
import { randomUUID } from "node:crypto";
import { claimMessage } from "../src/bot/dedupe";
import { supabase } from "../src/db/client";

/**
 * Replay / idempotency test (skill-up programme, Tier 1 / Phase 3).
 * Simulates a webhook re-delivery: the same (channel, message_id) is claimed
 * twice. The first claim must succeed (process it); the second must be rejected
 * (skip it). Proves a duplicated/retried delivery cannot fire a second action.
 *
 * Uses the bot's Supabase client (service role), so point it at staging/dev.
 * Usage:  REPLAY_TEST=1 npm run test:replay
 */
async function main() {
  if (process.env.REPLAY_TEST !== "1") {
    throw new Error(
      "Set REPLAY_TEST=1 to run. This writes to the bot's Supabase via the service " +
        "role — point it at a staging/dev project."
    );
  }

  const channel = "telegram";
  const messageId = `replay-${randomUUID()}`;
  const failures: string[] = [];

  try {
    const first = await claimMessage(channel, messageId);
    const second = await claimMessage(channel, messageId);

    if (first !== true) failures.push(`first delivery should be claimed (got ${first})`);
    if (second !== false) failures.push(`re-delivery should be rejected (got ${second})`);
  } finally {
    await supabase
      .from("processed_messages")
      .delete()
      .eq("channel", channel)
      .eq("message_id", messageId);
  }

  if (failures.length > 0) {
    console.error("✗ Replay/idempotency test FAILED:");
    failures.forEach((f) => console.error("  - " + f));
    process.exit(1);
  }
  console.log("✓ Re-delivered messages are de-duplicated (first claimed, replay rejected).");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
