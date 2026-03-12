import { appVersion } from "@/lib/version";

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "ระบบตรวจสอบและวิเคราะห์ค่าใช้จ่ายผู้ป่วย",
  description: "ตรวจสอบและวิเคราะห์ค่าใช้จ่ายผู้ป่วย เพื่อนำเสนอข้อมูล ;เงินเข้า-ออก; ในระดับรายคน รายคลินิก และรายแผนก",
  version: appVersion,
};
