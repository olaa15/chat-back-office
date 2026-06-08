import "dotenv/config";
import express from "express";
import { webhookCallback } from "grammy";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require("stripe");
import { createBot } from "./bot/webhook";
import { markInvoicePaidBySession } from "./db/queries";
import { handleBotMessage, handleReceiptImage } from "./bot/handlers";
import { downloadWhatsAppMedia, WhatsAppChannel } from "./bot/whatsapp";

const { TELEGRAM_BOT_TOKEN, WEBHOOK_URL, PORT = "3000", STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env;

if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!WEBHOOK_URL) throw new Error("WEBHOOK_URL is required");

const bot = createBot(TELEGRAM_BOT_TOKEN);
const app = express();

// Stripe webhook — must be raw body, registered before express.json()
if (STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET) {
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  app.post(
    "/stripe-webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"] as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let event: any;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        console.error("Stripe webhook signature failed:", err);
        res.status(400).send("Webhook signature failed");
        return;
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        try {
          const result = await markInvoicePaidBySession(session.id);
          if (result?.telegramUserId) {
            await bot.api.sendMessage(
              result.telegramUserId,
              `Payment received for ${result.invoiceNumber}! Your client has paid via Stripe.`
            );
          }
        } catch (err) {
          console.error("Failed to process Stripe payment:", err);
        }
      }

      res.json({ received: true });
    }
  );
}

app.use(express.json());
app.post(
  "/webhook",
  webhookCallback(bot, "express", { onTimeout: "return", timeoutMilliseconds: 8_000 })
);

// WhatsApp Cloud API webhook
const { WHATSAPP_VERIFY_TOKEN } = process.env;

app.get("/whatsapp-webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/whatsapp-webhook", (req, res) => {
  res.sendStatus(200); // ack immediately — WhatsApp retries if no 200 within 20s
  const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages;
  if (!messages?.length) return;
  const msg = messages[0];
  const phone = msg.from as string;
  const channel = new WhatsAppChannel(phone);

  if (msg.type === "text") {
    const text = (msg.text?.body as string)?.trim();
    if (!text) return;
    handleBotMessage(channel, text, "whatsapp").catch((err) =>
      console.error("WhatsApp handler error:", err)
    );
    return;
  }

  if (msg.type === "image") {
    const mediaId = msg.image?.id as string | undefined;
    if (!mediaId) return;
    downloadWhatsAppMedia(mediaId)
      .then(({ buffer, mimeType }) => handleReceiptImage(channel, buffer, mimeType, "whatsapp"))
      .catch((err) => console.error("WhatsApp image handler error:", err));
  }
});

app.listen(Number(PORT), async () => {
  await bot.api.setWebhook(`${WEBHOOK_URL}/webhook`);
  console.log(`Bot running on port ${PORT}`);
  console.log(`Webhook registered at ${WEBHOOK_URL}/webhook`);
});
