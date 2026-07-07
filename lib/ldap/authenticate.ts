import type { Entry } from "ldapts";
import type { LdapConfig } from "@/lib/ldap/config";

import { createLdapClient } from "@/lib/ldap/client";
import { escapeLdapFilter } from "@/lib/ldap/escape";

export type AuthenticatedAdUser = {
  username: string;
  displayName: string;
  department: string;
  dn: string;
  isAdmin: boolean;
};

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

function getAttrList(entry: Entry, name: string): string[] {
  const keys = Object.keys(entry).filter(
    (k) => k.toLowerCase() === name.toLowerCase() && k !== "dn"
  );
  const key = keys[0];

  if (!key) return [];
  const val = entry[key];

  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);

  return val != null ? [String(val).trim()] : [];
}

function normalizeUsername(raw: string): string {
  const trimmed = raw.trim();

  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed.split("@")[0] ?? "";
  if (trimmed.includes("\\")) return trimmed.split("\\").pop() ?? trimmed;

  return trimmed;
}

function normalizeDn(dn: string): string {
  return dn.replace(/\s*,\s*/g, ",").toLowerCase();
}

function isDnUnderBaseDn(userDn: string, baseDN: string): boolean {
  const user = normalizeDn(userDn);
  const base = normalizeDn(baseDN);

  return user === base || user.endsWith(`,${base}`);
}

async function findUserEntry(
  client: ReturnType<typeof createLdapClient>,
  config: LdapConfig,
  username: string
): Promise<Entry | null> {
  const sam = escapeLdapFilter(normalizeUsername(username));

  if (!sam) return null;

  const result = await client.search(config.baseDN, {
    filter: `(&(objectClass=user)(sAMAccountName=${sam}))`,
    scope: "sub",
    attributes: ["dn", "cn", "displayName", "sAMAccountName", "department", "memberOf"],
    returnAttributeValues: true,
    sizeLimit: 2,
  });

  if (result.searchEntries.length !== 1) return null;

  return result.searchEntries[0] as Entry;
}

async function verifyUserPassword(
  config: LdapConfig,
  username: string,
  password: string,
  userEntry: Entry
): Promise<boolean> {
  const sam = normalizeUsername(username);
  const client = createLdapClient(config);

  try {
    const upn = `${sam}@${config.userDomain}`;

    await client.bind(upn, password);
    await client.unbind();

    return true;
  } catch {}

  try {
    const dn = typeof userEntry.dn === "string" ? userEntry.dn : String(userEntry.dn);

    await client.bind(dn, password);
    await client.unbind();

    return true;
  } catch {
    return false;
  }
}

async function findGroupDn(
  client: ReturnType<typeof createLdapClient>,
  config: LdapConfig,
  groupCn: string
): Promise<string | null> {
  const result = await client.search(config.baseDN, {
    filter: `(&(objectClass=group)(cn=${escapeLdapFilter(groupCn)}))`,
    scope: "sub",
    attributes: ["dn"],
    returnAttributeValues: true,
    sizeLimit: 5,
  });

  if (result.searchEntries.length === 0) return null;
  const dn = result.searchEntries[0]?.dn;

  return dn != null ? String(dn) : null;
}

async function isUserInGroup(
  client: ReturnType<typeof createLdapClient>,
  config: LdapConfig,
  userEntry: Entry,
  groupCn: string
): Promise<boolean> {
  const userDn = String(userEntry.dn);
  const memberOf = getAttrList(userEntry, "memberOf").map((v) => v.toLowerCase());

  const groupDn = await findGroupDn(client, config, groupCn);

  if (!groupDn) return false;

  if (memberOf.includes(groupDn.toLowerCase())) return true;

  const groupResult = await client.search(groupDn, {
    scope: "base",
    attributes: ["member"],
    returnAttributeValues: true,
    sizeLimit: 1,
  });

  const groupEntry = groupResult.searchEntries[0] as Entry | undefined;
  const members = getAttrList(groupEntry ?? ({} as Entry), "member").map((v) => v.toLowerCase());

  if (members.includes(userDn.toLowerCase())) return true;

  const chainResult = await client.search(config.baseDN, {
    filter: `(&(objectClass=user)(distinguishedName=${escapeLdapFilter(userDn)})(memberOf:1.2.840.113556.1.4.1941:=${escapeLdapFilter(groupDn)}))`,
    scope: "sub",
    attributes: ["dn"],
    returnAttributeValues: true,
    sizeLimit: 1,
  });

  return chainResult.searchEntries.length > 0;
}

export async function authenticateAdUser(
  config: LdapConfig,
  username: string,
  password: string
): Promise<{ ok: true; user: AuthenticatedAdUser } | { ok: false; message: string }> {
  const sam = normalizeUsername(username);

  if (!sam || !password) {
    return { ok: false, message: "กรุณาระบุชื่อผู้ใช้และรหัสผ่าน" };
  }

  const client = createLdapClient(config);
  let userEntry: Entry | null = null;
  let isAdmin = false;

  try {
    await client.bind(config.bindDN, config.bindPassword);

    userEntry = await findUserEntry(client, config, sam);
    if (!userEntry) {
      return { ok: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
    }

    const userDn = String(userEntry.dn);

    if (!isDnUnderBaseDn(userDn, config.baseDN)) {
      return {
        ok: false,
        message: "ไม่มีสิทธิ์เข้าใช้งาน — บัญชีไม่อยู่ในโดเมนที่อนุญาต",
      };
    }

    isAdmin = await isUserInGroup(client, config, userEntry, config.authGroupCn);

    await client.unbind();
  } catch (error) {
    try {
      await client.unbind();
    } catch {
      // ignore
    }
    const msg = error instanceof Error ? error.message : "Unknown error";

    return { ok: false, message: `เชื่อมต่อ AD ไม่สำเร็จ: ${msg}` };
  }

  const passwordOk = await verifyUserPassword(config, sam, password, userEntry);

  if (!passwordOk) {
    return { ok: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  const entry = userEntry;

  return {
    ok: true,
    user: {
      username: getAttr(entry, "sAMAccountName") || sam,
      displayName: getAttr(entry, "displayName") || getAttr(entry, "cn") || sam,
      department: getAttr(entry, "department"),
      dn: String(entry.dn),
      isAdmin,
    },
  };
}
