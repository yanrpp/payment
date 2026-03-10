/**
 * อ่านเวอร์ชันแอปจาก package.json (ใช้ทั้ง server และ client หลัง build)
 */

import packageJson from "../package.json";

export const appVersion: string = packageJson.version ?? "0.0.0";
export const appName: string = packageJson.name ?? "procurement";
