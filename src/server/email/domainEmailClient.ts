import "server-only";

import { env } from "@/server/config/env";

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
};

export type DomainEmailMessage = {
  emailId: number;
  sendEmail: string;
  sendName: string;
  subject: string;
  toEmail: string;
  toName: string;
  createTime: string;
  type: number;
  content: string;
  text: string;
  isDel: number;
};

type EmailListParams = {
  toEmail?: string;
  sendName?: string;
  sendEmail?: string;
  subject?: string;
  content?: string;
  timeSort?: "asc" | "desc";
  type?: number;
  isDel?: number;
  num?: number;
  size?: number;
};

let cachedToken: { token: string; expiresAt: number } | null = null;
let refreshPromise: Promise<string> | null = null;

function apiUrl(path: string) {
  return new URL(path, env.DOMAIN_EMAIL_API_BASE_URL).toString();
}

async function requestJson<T>(path: string, init: RequestInit) {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Email API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse<T>;
  if (data.code !== 200) {
    throw new Error(data.message || "Email API returned an error");
  }
  return data.data;
}

async function generateToken() {
  const data = await requestJson<{ token: string }>("/api/public/genToken", {
    method: "POST",
    body: JSON.stringify({
      email: env.DOMAIN_EMAIL_ADMIN_EMAIL,
      password: env.DOMAIN_EMAIL_ADMIN_PASSWORD,
    }),
  });

  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + env.EMAIL_TOKEN_CACHE_TTL_SECONDS * 1000,
  };
  return data.token;
}

export async function getDomainEmailToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  if (!refreshPromise) {
    refreshPromise = generateToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function authorizedRequest<T>(path: string, body: unknown, retry = true): Promise<T> {
  const token = await getDomainEmailToken();

  try {
    return await requestJson<T>(path, {
      method: "POST",
      headers: { Authorization: token },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (!retry) throw error;
    cachedToken = null;
    const nextToken = await getDomainEmailToken();
    return requestJson<T>(path, {
      method: "POST",
      headers: { Authorization: nextToken },
      body: JSON.stringify(body),
    });
  }
}

export function listDomainEmails(params: EmailListParams) {
  return authorizedRequest<DomainEmailMessage[]>("/api/public/emailList", {
    timeSort: "desc",
    type: 0,
    isDel: 0,
    num: 1,
    size: 20,
    ...params,
  });
}

export function addDomainEmailUser(input: { email: string; password?: string; roleName?: string }) {
  return authorizedRequest<null>("/api/public/addUser", { list: [input] });
}

export async function testDomainEmailToken() {
  cachedToken = null;
  await getDomainEmailToken();
}
