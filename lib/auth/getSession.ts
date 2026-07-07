import type { NextApiRequest } from "next";
import type { AuthSession } from "@/lib/auth/constants";

import { getSessionFromCookieHeader } from "@/lib/auth/session";

export function getSessionFromRequest(req: NextApiRequest): AuthSession | null {
  return getSessionFromCookieHeader(req.headers.cookie);
}
