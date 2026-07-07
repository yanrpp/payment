import type { LdapConfig } from "@/lib/ldap/config";

import { Client } from "ldapts";

export function createLdapClient(config: LdapConfig): Client {
  const tlsServerName = process.env.LDAP_TLS_SERVERNAME?.trim();

  return new Client({
    url: config.url,
    timeout: 15000,
    connectTimeout: 10000,
    tlsOptions: config.url.toLowerCase().startsWith("ldaps")
      ? {
          minVersion: "TLSv1.2",
          rejectUnauthorized: false,
          ...(tlsServerName ? { servername: tlsServerName } : {}),
        }
      : undefined,
  });
}
