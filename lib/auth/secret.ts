const SESSION_SECRET_PLACEHOLDER = "ใส่สตริงสุ่มยาวๆ";

export class SessionSecretNotConfiguredError extends Error {
  constructor() {
    super("SESSION_SECRET is not configured");
    this.name = "SessionSecretNotConfiguredError";
  }
}

export function isSessionSecretConfigured(): boolean {
  const secret = process.env.SESSION_SECRET?.trim();

  return Boolean(secret && secret !== SESSION_SECRET_PLACEHOLDER);
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();

  if (secret && secret !== SESSION_SECRET_PLACEHOLDER) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new SessionSecretNotConfiguredError();
  }

  return "dev-insecure-session-secret-change-me";
}
