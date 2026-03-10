import { appVersion } from "@/lib/version";

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "ระบบต้นแบบ (Template)",
  description: "Next.js + Oracle + MySQL — สำหรับนำไปสร้างระบบอื่น",
  version: appVersion,
};
