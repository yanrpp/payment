import type { NextApiRequest, NextApiResponse } from "next";

import { authenticateAdUser } from "@/lib/ldap/authenticate";
import { getLdapConfig } from "@/lib/ldap/config";
import { SessionSecretNotConfiguredError } from "@/lib/auth/secret";
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
      message: "ไม่ได้ตั้งค่า LDAP (LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD)",
    });
  }

  const body = (typeof req.body === "object" && req.body != null ? req.body : {}) as LoginBody;
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  let result;

  try {
    result = await authenticateAdUser(config, username, password);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      success: false,
      message: `เชื่อมต่อ AD ไม่สำเร็จ: ${msg}`,
    });
  }

  if (!result.ok) {
    return res.status(401).json({ success: false, message: result.message });
  }

  let token: string;

  try {
    token = createSessionToken({
      username: result.user.username,
      displayName: result.user.displayName,
      department: result.user.department,
      isAdmin: result.user.isAdmin,
    });
  } catch (error) {
    if (error instanceof SessionSecretNotConfiguredError) {
      return res.status(500).json({
        success: false,
        message:
          "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SESSION_SECRET ใน .env.local — ติดต่อผู้ดูแลระบบ",
      });
    }

    throw error;
  }

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
