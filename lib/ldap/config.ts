export type LdapConfig = {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  userDomain: string;
  authGroupCn: string;
};

export function getLdapConfig(): LdapConfig | null {
  const url = process.env.LDAP_URL?.trim();
  const baseDN = process.env.LDAP_BASE_DN?.trim();
  const bindDN = process.env.LDAP_BIND_DN?.trim();
  const bindPassword = process.env.LDAP_BIND_PASSWORD;

  if (!url || !baseDN || !bindDN || !bindPassword) {
    return null;
  }

  const userDomain =
    process.env.LDAP_USER_DOMAIN?.trim() ||
    (bindDN.includes("@") ? bindDN.split("@").slice(1).join("@") : "rpphosp.local");

  const authGroupCn = process.env.LDAP_AUTH_GROUP?.trim() || "payment";

  return { url, baseDN, bindDN, bindPassword, userDomain, authGroupCn };
}
