/**
 * API: ดึงสมาชิกกลุ่ม Ad_it (rpphosp.local/Users-RPP/manage Ad_it)
 * คืนค่า cn, samAccountName, department ของแต่ละ user
 * GET /api/db/ldap-adit-members
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { Client } from "ldapts";

import type { Entry } from "ldapts";

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

  if (!url || !bindDN || !bindPassword || !baseDN) {
    return null;
  }

  return { url, baseDN, bindDN, bindPassword };
}

function getAttr(entry: Entry, name: string): string {
  const keys = Object.keys(entry).filter(
    (k) => k.toLowerCase() === name.toLowerCase() && k !== "dn"
  );
  const key = keys[0];
  if (!key) return "";
  const val = entry[key];
  if (Array.isArray(val)) return (val[0] ?? "").toString().trim();
  return val != null ? String(val).trim() : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const config = getLdapConfig();
  if (!config) {
    return res.status(400).json({
      success: false,
      message: "ไม่ได้ตั้งค่า LDAP ใน .env.local (ต้องการ LDAP_URL, LDAP_BASE_DN, LDAP_BIND_DN, LDAP_BIND_PASSWORD)",
      data: [],
      timestamp: new Date().toISOString(),
    });
  }

  const client = new Client({
    url: config.url,
    timeout: 15000,
    connectTimeout: 10000,
    tlsOptions:
      config.url.toLowerCase().startsWith("ldaps")
        ? { minVersion: "TLSv1.2", rejectUnauthorized: false }
        : undefined,
  });

  try {
    await client.bind(config.bindDN, config.bindPassword);

    // หา group Ad_it ภายใต้ rpphosp.local/Users-RPP/manage (Canonical: rpphosp.local/Users-RPP/manage Ad_it)
    const groupSearch = await client.search(config.baseDN, {
      filter: "(&(objectClass=group)(cn=manage Ad_it))",
      scope: "sub",
      attributes: ["member"],
      returnAttributeValues: true,
      sizeLimit: 1,
    });

    const groupEntry = groupSearch.searchEntries[0] as Entry | undefined;
    const memberDns = groupEntry?.member;
    const dnList: string[] = Array.isArray(memberDns)
      ? memberDns.map((d) => (typeof d === "string" ? d : String(d)))
      : memberDns
        ? [typeof memberDns === "string" ? memberDns : String(memberDns)]
        : [];

    const members: { cn: string; samAccountName: string; department: string }[] = [];

    for (const memberDn of dnList) {
      if (!memberDn || typeof memberDn !== "string") continue;
      try {
        const userSearch = await client.search(memberDn, {
          scope: "base",
          attributes: ["cn", "sAMAccountName", "department"],
          returnAttributeValues: true,
          sizeLimit: 1,
        });
        const userEntry = userSearch.searchEntries[0] as Entry | undefined;
        if (!userEntry) continue;
        members.push({
          cn: getAttr(userEntry, "cn"),
          samAccountName: getAttr(userEntry, "samAccountName"),
          department: getAttr(userEntry, "department"),
        });
      } catch {
        // ข้าม member ที่ดึงไม่ได้
      }
    }

    await client.unbind();

    res.status(200).json({
      success: true,
      message: "ดึงสมาชิกกลุ่ม Ad_it (rpphosp.local/Users-RPP/manage Ad_it) สำเร็จ",
      group: "Ad_it",
      count: members.length,
      data: members,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    try {
      await client.unbind();
    } catch {
      // ignore
    }
    res.status(500).json({
      success: false,
      message: "ดึงสมาชิกกลุ่ม LDAP ไม่สำเร็จ",
      error: errorMessage,
      data: [],
      timestamp: new Date().toISOString(),
    });
  }
}
