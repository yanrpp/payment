import type { NextApiRequest, NextApiResponse } from "next";

import { isSessionSecretConfigured } from "@/lib/auth/secret";
import { getLdapConfig } from "@/lib/ldap/config";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const ldap = getLdapConfig();

  return res.status(200).json({
    success: true,
    ldapConfigured: ldap != null,
    sessionConfigured: isSessionSecretConfigured(),
    nodeEnv: process.env.NODE_ENV ?? "development",
    useHttps: process.env.USE_HTTPS === "true",
  });
}
