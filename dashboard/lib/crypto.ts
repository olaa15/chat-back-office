import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm" as const;
const PREFIX = "v1:";

function getKey(): Buffer {
  const raw = process.env.BANK_FIELD_KEY;
  if (!raw) throw new Error("BANK_FIELD_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32)
    throw new Error("BANK_FIELD_KEY must be exactly 32 bytes when base64-decoded");
  return key;
}

export function encryptField(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for AES-GCM
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptField(ciphertext: string): string {
  if (!ciphertext.startsWith(PREFIX)) {
    // Legacy plaintext — pass through so existing rows remain readable until backfilled.
    return ciphertext;
  }
  const key = getKey();
  const parts = ciphertext.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString("utf8") + decipher.final("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
