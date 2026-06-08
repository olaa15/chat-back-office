import { Bot } from "grammy";
import { handleBotMessage, handleReceiptImage } from "./handlers";
import { TelegramChannel } from "./telegram-channel";
import { getBusinessForTelegramUser, getConnectCode } from "../db/queries";

const TELEGRAM_PHOTO_MIME_TYPE = "image/jpeg"; // Telegram always re-encodes photos as JPEG

export function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command("mycode", async (ctx) => {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;
    const businessId = await getBusinessForTelegramUser(telegramUserId);
    if (!businessId) {
      await ctx.reply("Your Telegram isn't linked to a business yet.");
      return;
    }
    const code = await getConnectCode(businessId);
    if (!code) {
      await ctx.reply("No connect code found. Please complete onboarding in the dashboard first.");
      return;
    }
    await ctx.reply(`Your connect code is: *${code}*\n\nSend this in WhatsApp to link your WhatsApp account to your business.`, { parse_mode: "Markdown" });
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    const channel = new TelegramChannel(ctx);
    await handleBotMessage(channel, text, "telegram");
  });

  bot.on("message:photo", async (ctx) => {
    const channel = new TelegramChannel(ctx);
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    const file = await ctx.api.getFile(largest.file_id);
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) {
      await channel.sendText("I couldn't download that photo. Please try sending it again.");
      return;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await handleReceiptImage(channel, buffer, TELEGRAM_PHOTO_MIME_TYPE, "telegram");
  });

  return bot;
}
