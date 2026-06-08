import { BotChannel } from "./channel";
import { getSignedPdfUrl } from "../db/queries";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

const getBase = () => `${GRAPH_BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

const getHeaders = () => ({
  Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
  "Content-Type": "application/json",
});

const getAuthHeader = () => ({ Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` });

/**
 * Downloads a media attachment (e.g. a receipt photo) from the WhatsApp
 * Cloud API. This is a two-step fetch: resolve the media id to a signed
 * URL, then download the bytes from that URL with the same bearer token.
 */
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaRes = await fetch(`${GRAPH_BASE}/${mediaId}`, { headers: getAuthHeader() });
  if (!metaRes.ok) {
    throw new Error(`WhatsApp media lookup error ${metaRes.status}: ${await metaRes.text()}`);
  }
  const meta = (await metaRes.json()) as { url: string; mime_type: string };

  const fileRes = await fetch(meta.url, { headers: getAuthHeader() });
  if (!fileRes.ok) {
    throw new Error(`WhatsApp media download error ${fileRes.status}: ${await fileRes.text()}`);
  }

  return {
    buffer: Buffer.from(await fileRes.arrayBuffer()),
    mimeType: meta.mime_type,
  };
}

async function post(body: object): Promise<void> {
  const res = await fetch(getBase(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp API error ${res.status}: ${text}`);
  }
}

export async function sendWhatsAppText(to: string, text: string): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

export async function sendWhatsAppDocument(
  to: string,
  link: string,
  filename: string,
  caption: string
): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: { link, filename, caption },
  });
}

/**
 * Renders the Stripe checkout link as a tappable CTA-URL button rather than
 * dumping the raw (very long) URL as plain text — mirrors the inline "Pay
 * now" button Telegram gets via InlineKeyboard.
 */
export async function sendWhatsAppPaymentButton(to: string, url: string): Promise<void> {
  await post({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: "Tap below to pay this invoice securely via Stripe." },
      action: {
        name: "cta_url",
        parameters: { display_text: "💳 Pay now", url },
      },
    },
  });
}

export class WhatsAppChannel implements BotChannel {
  userId: string;

  constructor(phone: string) {
    this.userId = phone;
  }

  async sendText(text: string): Promise<void> {
    await sendWhatsAppText(this.userId, text);
  }

  async sendTyping(): Promise<void> {
    // WhatsApp doesn't have a typing indicator in Cloud API — no-op
  }

  async sendDocument(
    _buffer: Buffer,
    filename: string,
    storagePath: string,
    caption: string,
    payUrl?: string
  ): Promise<void> {
    const signedUrl = await getSignedPdfUrl(storagePath);
    if (!signedUrl) {
      await this.sendText(`Your invoice is ready but I couldn't send the PDF directly. Please check your dashboard.`);
      return;
    }
    await sendWhatsAppDocument(this.userId, signedUrl, filename, caption);
    if (payUrl) {
      await sendWhatsAppPaymentButton(this.userId, payUrl);
    }
  }
}
