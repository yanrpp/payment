import type { NextApiResponse } from "next";

import { createHmac, timingSafeEqual } from "crypto";

import { AUTH_COOKIE_NAME, AUTH_SESSION_MAX_AGE_SEC, type AuthSession } from "@/lib/auth/constants";
import { getSessionSecret } from "@/lib/auth/secret";

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signPayload(payloadB64: string): string {
  return createHmac("sha256", getSessionSecret()).update(payloadB64).digest("base64url");
}

export function createSessionToken(user: Omit<AuthSession, "exp">): string {
  const session: AuthSession = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + AUTH_SESSION_MAX_AGE_SEC,
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(session));
  const sig = signPayload(payloadB64);

  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): AuthSession | null {
  if (!token) return null;

  const [payloadB64, sig] = token.split(".");

  if (!payloadB64 || !sig) return null;

  const expected = signPayload(payloadB64);
  const sigBuf = Uint8Array.from(Buffer.from(sig));
  const expectedBuf = Uint8Array.from(Buffer.from(expected));

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payloadB64)) as AuthSession;

    if (!session?.username || !session?.exp) return null;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;

    return session;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextApiResponse, token: string): void {
  const secure = process.env.USE_HTTPS === "true";
  const parts = [
    `${AUTH_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${AUTH_SESSION_MAX_AGE_SEC}`,
  ];

  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: NextApiResponse): void {
  const secure = process.env.USE_HTTPS === "true";
  const parts = [`${AUTH_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function getSessionFromCookieHeader(cookieHeader: string | undefined): AuthSession | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));

  if (!match) return null;
  const token = match.slice(AUTH_COOKIE_NAME.length + 1);

  return verifySessionToken(token);
}
