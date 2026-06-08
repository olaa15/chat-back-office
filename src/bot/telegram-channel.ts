import { Context, InputFile, InlineKeyboard } from "grammy";
import { BotChannel } from "./channel";

export class TelegramChannel implements BotChannel {
  userId: string;
  private ctx: Context;

  constructor(ctx: Context) {
    this.ctx = ctx;
    this.userId = String(ctx.from!.id);
  }

  async sendText(text: string): Promise<void> {
    await this.ctx.reply(text);
  }

  async sendTyping(): Promise<void> {
    await this.ctx.replyWithChatAction("typing");
  }

  async sendDocument(
    buffer: Buffer,
    filename: string,
    _storagePath: string,
    caption: string,
    payUrl?: string
  ): Promise<void> {
    const replyMarkup = payUrl ? new InlineKeyboard().url("💳 Pay now", payUrl) : undefined;
    await this.ctx.replyWithDocument(
      new InputFile(buffer, filename),
      { caption, reply_markup: replyMarkup }
    );
  }
}
