import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

/**
 * 从密码派生密钥（使用 scrypt）
 */
function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "teax-salt", 32);
}

/**
 * 加密文本
 * @param plaintext 明文
 * @param secret 加密密钥（从环境变量获取）
 * @returns 加密后的字符串（格式：iv:authTag:ciphertext，均为 hex）
 */
export function encrypt(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // 返回格式：iv:authTag:ciphertext
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * 解密文本
 * @param ciphertext 加密的字符串（格式：iv:authTag:ciphertext）
 * @param secret 解密密钥
 * @returns 解密后的明文
 */
export function decrypt(ciphertext: string, secret: string): string {
  const key = deriveKey(secret);
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const encrypted = Buffer.from(encryptedHex!, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
