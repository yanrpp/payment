/**
 * ฟังก์ชันจัดรูปแบบตัวเลขสำหรับ UI (วงเงิน/งบประมาณ บาท)
 */

/** จัดรูปแบบตัวเลขเป็น string มี comma คั่นหลักพัน (เมื่อเกิน 3 หลัก) */
export function formatNumberWithCommas(value: string): string {
  if (!value) return "";
  const stripped = value.replace(/,/g, "");
  const parts = stripped.split(".");
  const intPart = parts[0].replace(/\D/g, "") || "0";
  const decPart = parts[1] != null ? "." + parts[1].replace(/\D/g, "").slice(0, 2) : "";
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return formatted + decPart;
}

/** ดึงเฉพาะตัวเลขและจุดทศนิยมจาก string (สำหรับเก็บใน state) */
export function parseRawAmount(value: string): string {
  const stripped = value.replace(/,/g, "");
  const match = stripped.match(/^\d*\.?\d*/);
  return match ? match[0] : "";
}
