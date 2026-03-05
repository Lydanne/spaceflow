import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT = "teax-service-token";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

/**
 * AES-256-GCM 加密。返回 base64 编码的 iv:authTag:ciphertext。
 */
export function encrypt(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * AES-256-GCM 解密。输入格式：iv:authTag:ciphertext（base64）。
 */
export function decrypt(encryptedData: string, secret: string): string {
  const key = deriveKey(secret);
  const [ivB64, authTagB64, ciphertext] = encryptedData.split(":");

  if (!ivB64 || !authTagB64 || !ciphertext) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
