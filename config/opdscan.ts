/** การตั้งค่า SMB สำหรับโฟลเดอร์สแกน OPD (server-only) */
export const opdscanConfig = {
  host: process.env.OPDSCAN_SMB_HOST ?? "192.168.108.145",
  share: process.env.OPDSCAN_SMB_SHARE ?? "opdscan$",
  username: process.env.OPDSCAN_SMB_USER ?? "userrpp",
  password: process.env.OPDSCAN_SMB_PASSWORD ?? "userrpp",
};

export function getOpdscanUncRoot(): string {
  const { host, share } = opdscanConfig;

  return `\\\\${host}\\${share}`;
}
