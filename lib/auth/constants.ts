export const AUTH_COOKIE_NAME = "payment_session";
export const AUTH_SESSION_MAX_AGE_SEC = 8 * 60 * 60;

export type AuthSession = {
  username: string;
  displayName: string;
  department: string;
  isAdmin: boolean;
  exp: number;
};

export const PUBLIC_PATHS = ["/login"] as const;
export const PUBLIC_API_PREFIXES = ["/api/auth/"] as const;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number])) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;

  return false;
}

export function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
