/**
 * API Route: ทดสอบการเชื่อมต่อ LDAP (Active Directory)
 * GET /api/db/test-ldap
 * ใช้ตัวแปรจาก .env.local: LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { Client } from "ldapts";

function getLdapConfig(): {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
} | null {
  const url = process.env.LDAP_URL;
  const baseDN = process.env.LDAP_BASE_DN;
  const bindDN = process.env.LDAP_BIND_DN;
  const bindPassword = process.env.LDAP_BIND_PASSWORD;

  if (!url || !bindDN || !bindPassword) {
    return null;
  }

  return {
    url,
    baseDN: baseDN ?? "",
    bindDN,
    bindPassword,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const config = getLdapConfig();

  if (!config) {
    return res.status(400).json({
      success: false,
      message: "ไม่ได้ตั้งค่า LDAP ใน .env.local",
      hint: "ต้องการ LDAP_URL, LDAP_BIND_DN, LDAP_BIND_PASSWORD (LDAP_BASE_DN ถ้ามี)",
      timestamp: new Date().toISOString(),
    });
  }

  const client = new Client({
    url: config.url,
    timeout: 10000,
    connectTimeout: 10000,
    tlsOptions:
      config.url.toLowerCase().startsWith("ldaps")
        ? { minVersion: "TLSv1.2", rejectUnauthorized: false }
        : undefined,
  });

  try {
    await client.bind(config.bindDN, config.bindPassword);
    await client.unbind();

    res.status(200).json({
      success: true,
      message: "เชื่อมต่อ LDAP สำเร็จ",
      config: {
        url: config.url,
        baseDN: config.baseDN || "(ไม่ระบุ)",
        bindDN: config.bindDN,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      success: false,
      message: "เชื่อมต่อ LDAP ล้มเหลว",
      error: errorMessage,
      config: {
        url: config.url,
        baseDN: config.baseDN || "(ไม่ระบุ)",
        bindDN: config.bindDN,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
