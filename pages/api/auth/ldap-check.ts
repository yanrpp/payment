import type { NextApiRequest, NextApiResponse } from "next";

import { createLdapClient } from "@/lib/ldap/client";
import { getLdapConfig } from "@/lib/ldap/config";

/** GET /api/auth/ldap-check — ทดสอบ bind บัญชี service LDAP (ไม่ต้อง login) */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const config = getLdapConfig();

  if (!config) {
    return res.status(500).json({
      success: false,
      message: "ไม่ได้ตั้งค่า LDAP",
    });
  }

  const client = createLdapClient(config);

  try {
    await client.bind(config.bindDN, config.bindPassword);
    await client.unbind();

    return res.status(200).json({
      success: true,
      message: "เชื่อมต่อ LDAP สำเร็จ",
    });
  } catch (error) {
    try {
      await client.unbind();
    } catch {
      // ignore
    }

    const msg = error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      success: false,
      message: `เชื่อมต่อ LDAP ล้มเหลว: ${msg}`,
    });
  }
}
