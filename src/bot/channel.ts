export interface BotChannel {
  userId: string;
  sendText(text: string): Promise<void>;
  sendTyping(): Promise<void>;
  sendDocument(
    buffer: Buffer,
    filename: string,
    storagePath: string,
    caption: string,
    payUrl?: string
  ): Promise<void>;
}
