import "server-only";

import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(16),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(6),
  DOMAIN_EMAIL_API_BASE_URL: z.string().url(),
  DOMAIN_EMAIL_ADMIN_EMAIL: z.string().email(),
  DOMAIN_EMAIL_ADMIN_PASSWORD: z.string().min(1),
  EMAIL_TOKEN_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  EMAIL_CODE_POLL_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  EMAIL_CODE_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(5),
});

export const env = envSchema.parse(process.env);
