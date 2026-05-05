import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const gptAccountSchema = z.object({
  label: z.string().min(1),
  loginEmail: z.string().email(),
  password: z.string().min(1),
  capacity: z.coerce.number().int().min(1).max(10).default(3),
  notes: z.string().optional(),
});

export const gptAccountUpdateSchema = z.object({
  label: z.string().min(1).optional(),
  loginEmail: z.string().email().optional(),
  password: z.string().min(1).optional(),
  capacity: z.coerce.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
  status: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]).optional(),
});

export const monthlyMembershipSchema = z.object({
  wechatName: z.string().min(1),
  cdkCode: z.string().min(8).max(64).optional(),
  gptAccountId: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  requestLimitPerDay: z.coerce.number().int().min(1).max(20).default(3),
});

export const createCdkSchema = z.object({
  wechatName: z.string().min(1),
  durationDays: z.coerce.number().int().min(1).max(31),
  gptAccountId: z.string().min(1),
  requestLimitPerDay: z.coerce.number().int().min(1).max(20).default(3),
});

export const cdkCodeSchema = z.object({
  code: z.string().min(8).max(64),
});

export const testEmailListSchema = z.object({
  email: z.string().email(),
});

export const addEmailUserSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  roleName: z.string().optional(),
});

export const monthlyRequestCodeSchema = z.object({
  gptAccountId: z.string().min(1),
});
