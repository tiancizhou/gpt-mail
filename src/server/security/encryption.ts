import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "@/server/config/env";

const key = createHash("sha256").update(env.ENCRYPTION_KEY).digest();

export function encryptText(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptText(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted value");

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
