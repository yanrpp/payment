import type { NextApiRequest, NextApiResponse } from "next";

import { authenticateAdUser } from "@/lib/ldap/authenticate";
import { getLdapConfig } from "@/lib/ldap/config";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";

type LoginBody = {
  username?: string;
  password?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const config = getLdapConfig();

  if (!config) {
    return res.status(500).json({
      success: false,
      message: "ไม่ได้ตั้งค่า LDAP ใน .env.local",
    });
  }

  const body = (typeof req.body === "object" && req.body != null ? req.body : {}) as LoginBody;
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  const result = await authenticateAdUser(config, username, password);

  if (!result.ok) {
    return res.status(401).json({ success: false, message: result.message });
  }

  const token = createSessionToken({
    username: result.user.username,
    displayName: result.user.displayName,
    department: result.user.department,
    isAdmin: result.user.isAdmin,
  });

  setSessionCookie(res, token);

  return res.status(200).json({
    success: true,
    user: {
      username: result.user.username,
      displayName: result.user.displayName,
      department: result.user.department,
      isAdmin: result.user.isAdmin,
    },
  });
}
