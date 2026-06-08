import "dotenv/config";
import crypto from "node:crypto";
import express, { type Request } from "express";
import { webhookCallback } from "grammy";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Stripe = require("stripe");
import { createBot } from "./bot/webhook";
import { markInvoicePaidBySession } from "./db/queries";
import { handleBotMessage, handleReceiptImage } from "./bot/handlers";
import { downloadWhatsAppMedia, WhatsAppChannel } from "./bot/whatsapp";

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET,
  WEBHOOK_URL,
  PORT = "3000",
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  WHATSAPP_APP_SECRET,
  WHATSAPP_VERIFY_TOKEN,
} = process.env;

if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is required");
if (!WEBHOOK_URL) throw new Error("WEBHOOK_URL is required");
if (!TELEGRAM_WEBHOOK_SECRET) throw new Error("TELEGRAM_WEBHOOK_SECRET is required");

const bot = createBot(TELEGRAM_BOT_TOKEN);
const app = express();

// ── Stripe webhook — raw body, registered before express.json() ───────────
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

// Parse JSON AND retain the raw bytes so we can verify the WhatsApp HMAC signature.
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ── Telegram webhook ──────────────────────────────────────────────────────
// Reject any call that doesn't carry the secret token we registered with
// setWebhook. Telegram sends it on every update in this header; without the
// check, anyone who learns the URL can POST forged updates.
app.use("/webhook", (req, res, next) => {
  if (req.header("X-Telegram-Bot-Api-Secret-Token") !== TELEGRAM_WEBHOOK_SECRET) {
    res.sendStatus(401);
    return;
  }
  next();
});
app.post(
  "/webhook",
  webhookCallback(bot, "express", { onTimeout: "return", timeoutMilliseconds: 8_000 })
);

// ── WhatsApp webhook ──────────────────────────────────────────────────────
app.get("/whatsapp-webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
    res.send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Verify the payload genuinely came from Meta (HMAC-SHA256 over the raw body,
// keyed by the WhatsApp App Secret), using a timing-safe comparison.
function whatsappSignatureValid(req: Request & { rawBody?: Buffer }): boolean {
  if (!WHATSAPP_APP_SECRET) return false;
  const header = req.header("X-Hub-Signature-256");
  if (!header || !req.rawBody) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", WHATSAPP_APP_SECRET).update(req.rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post("/whatsapp-webhook", (req: Request & { rawBody?: Buffer }, res) => {
  if (!whatsappSignatureValid(req)) {
    res.sendStatus(401);
    return;
  }
  res.sendStatus(200); // ack fast — Meta retries if no 200 within ~20s

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
  // Register the same secret token Telegram will echo back on each update.
  await bot.api.setWebhook(`${WEBHOOK_URL}/webhook`, {
    secret_token: TELEGRAM_WEBHOOK_SECRET,
  });
  console.log(`Bot running on port ${PORT}`);
  console.log(`Webhook registered at ${WEBHOOK_URL}/webhook`);
});
