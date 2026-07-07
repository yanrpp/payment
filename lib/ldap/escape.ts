/** Escape ค่าสำหรับใส่ใน LDAP filter (ป้องกัน injection) */
export function escapeLdapFilter(value: string): string {
  return value.replace(/[\\*()\0]/g, (ch) => `\\${ch.charCodeAt(0).toString(16).padStart(2, "0")}`);
}
