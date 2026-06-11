import crypto from "node:crypto";

// Application-layer encryption for sensitive at-rest fields (e.g. bank account
// number). AES-256-GCM with a 32-byte key supplied via BANK_FIELD_KEY.
// Server-only — never import this into a client component.

const VERSION = "v1";
const IV_BYTES = 12; // GCM standard nonce length
const TAG_BYTES = 16;
const KEY_BYTES = 32; // AES-256

function getKey(): Buffer {
  const raw = process.env.BANK_FIELD_KEY;
  if (!raw) {
    throw new Error(
      "BANK_FIELD_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `BANK_FIELD_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}). ` +
        "Generate one with: openssl rand -base64 32"
    );
  }
  return key;
}

/** Encrypt a sensitive string. Returns a versioned, base64 token safe for a text column. */
export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // packed = iv | tag | ciphertext, then base64, prefixed with the scheme version
  return `${VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

/**
 * Decrypt a value produced by encryptField.
 * Values without the version prefix are treated as legacy plaintext and returned
 * unchanged, so pre-existing rows keep working until the backfill re-encrypts them.
 * Throws if a versioned token fails authentication (tampered or wrong key).
 */
export function decryptField(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(`${VERSION}:`)) return stored; // legacy plaintext
  const packed = Buffer.from(stored.slice(VERSION.length + 1), "base64");
  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = packed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8"
  );
}

/** True if a stored value is already encrypted with this scheme. */
export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === "string" && stored.startsWith(`${VERSION}:`);
}
