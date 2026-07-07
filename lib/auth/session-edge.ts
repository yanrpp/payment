import type { AuthSession } from "@/lib/auth/constants";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();

  if (!secret || secret === "ใส่สตริงสุ่มยาวๆ") {
    return "dev-insecure-session-secret-change-me";
  }

  return secret;
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);

  return Buffer.from(base64, "base64").toString("utf8");
}

async function signPayload(payloadB64: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));

  return Buffer.from(sig).toString("base64url");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;

  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);

  return diff === 0;
}

export async function verifySessionTokenEdge(
  token: string | undefined | null
): Promise<AuthSession | null> {
  if (!token) return null;

  const [payloadB64, sig] = token.split(".");

  if (!payloadB64 || !sig) return null;

  const expected = await signPayload(payloadB64);

  if (!timingSafeEqualStr(sig, expected)) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payloadB64)) as AuthSession;

    if (!session?.username || !session?.exp) return null;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;

    return session;
  } catch {
    return null;
  }
}
