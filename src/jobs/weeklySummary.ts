import Anthropic from "@anthropic-ai/sdk";
import { schedules } from "@trigger.dev/sdk/v3";
import { Bot } from "grammy";
import { createClient } from "@supabase/supabase-js";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

function weekRange(): string {
  const end = new Date();
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export const weeklySummaryTask = schedules.task({
  id: "weekly-business-summary",
  cron: "0 9 * * 1", // Every Monday at 9am UTC
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 60_000,
    maxTimeoutInMs: 300_000,
    randomize: false,
  },
  run: async () => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sinceDate = since.toISOString().split("T")[0];

    // Fetch all linked businesses
    const { data: links, error: linksError } = await supabase
      .from("telegram_links")
      .select("telegram_user_id, business_id, businesses(name, currency)")
      .not("linked_at", "is", null);

    if (linksError) throw new Error(`Failed to fetch links: ${linksError.message}`);
    if (!links || links.length === 0) {
      console.log("No linked businesses found — nothing to summarise.");
      return;
    }

    console.log(`Sending weekly summaries to ${links.length} business(es).`);

    for (const link of links) {
      const businessId = link.business_id as string;
      const telegramUserId = link.telegram_user_id as number;
      const businessRow = link.businesses as unknown;
      const business = Array.isArray(businessRow) ? businessRow[0] : businessRow as { name: string; currency: string } | null;
      const businessName = business?.name ?? "Your business";
      const currency = business?.currency ?? "GBP";

      try {
        // Fetch last 7 days of invoices
        const { data: invoices } = await supabase
          .from("invoices")
          .select("invoice_number, client_name, total, status")
          .eq("business_id", businessId)
          .gte("issue_date", sinceDate);

        // Fetch last 7 days of payments
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("business_id", businessId)
          .gte("paid_at", since.toISOString());

        // Fetch outstanding balance
        const { data: outstanding } = await supabase
          .from("invoices")
          .select("total")
          .eq("business_id", businessId)
          .in("status", ["sent", "overdue"]);

        // Compute totals in code — never let the model do arithmetic
        const invoiceTotal = (invoices ?? []).reduce((s, i) => s + Number(i.total), 0);
        const paymentTotal = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
        const outstandingTotal = (outstanding ?? []).reduce((s, i) => s + Number(i.total), 0);
        const newClients = [...new Set((invoices ?? []).map((i) => i.client_name))];

        const prompt = `You are a friendly business assistant. Write a brief weekly summary for a business owner.
Keep it warm, concise, and under 150 words. Use plain text (no markdown or bullet points).

Business: ${businessName}
Week: ${weekRange()}

Invoices raised this week: ${invoices?.length ?? 0} (total: ${formatCurrency(invoiceTotal, currency)})
Payments received: ${payments?.length ?? 0} (total: ${formatCurrency(paymentTotal, currency)})
Outstanding balance: ${formatCurrency(outstandingTotal, currency)}
Clients invoiced this week: ${newClients.length > 0 ? newClients.join(", ") : "none"}

Write the summary now. Start with "Weekly summary for ${businessName}:" on the first line.`;

        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        });

        const summaryText =
          response.content.find((b) => b.type === "text")?.text ??
          `Weekly summary for ${businessName}: No activity this week.`;

        await bot.api.sendMessage(telegramUserId, summaryText);

        await supabase.from("audit_log").insert({
          business_id: businessId,
          actor: "bot",
          action: "summary.sent",
          entity_type: "business",
          entity_id: businessId,
          metadata: {
            invoiceCount: invoices?.length ?? 0,
            invoiceTotal,
            paymentTotal,
            outstandingTotal,
          },
        });

        console.log(`✓ Summary sent to ${businessName} (${telegramUserId})`);
      } catch (err) {
        // Log and continue — don't let one business failure kill the whole run
        console.error(`✗ Failed to summarise ${businessName}:`, err);
      }
    }
  },
});
