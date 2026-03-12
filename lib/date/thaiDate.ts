export const THAI_MONTH_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export type ThaiShortMonth = (typeof THAI_MONTH_SHORT)[number];

export function isoToThaiDisplay(iso: string | null | undefined): string {
  if (!iso) return "";
  const [yearStr, monthStr, dayStr] = iso.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);
  if (!year || monthIndex < 0 || monthIndex > 11 || !day) return "";
  const buddhistYear = year + 543;
  const monthLabel = THAI_MONTH_SHORT[monthIndex];
  return `${day.toString().padStart(2, "0")} ${monthLabel} ${buddhistYear}`;
}

export function thaiInputToIso(thai: string): string | null {
  // รองรับรูปแบบ 10/03/2569 หรือ 10-03-2569
  const trimmed = thai.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/-/g, "/");
  const parts = normalized.split("/");
  if (parts.length !== 3) return null;
  const [dayStr, monthStr, yearStr] = parts;
  const day = Number(dayStr);
  const month = Number(monthStr);
  const buddhistYear = Number(yearStr);
  if (!day || !month || !buddhistYear) return null;
  const year = buddhistYear - 543;
  if (year < 1900 || year > 2600 || month < 1 || month > 12) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

export function isoToThaiInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const [yearStr, monthStr, dayStr] = iso.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return "";
  const buddhistYear = year + 543;
  return `${day.toString().padStart(2, "0")}/${month.toString().padStart(2, "0")}/${buddhistYear}`;
}

export function getDaysInMonth(year: number, monthIndex: number): number {
  // monthIndex: 0-11
  return new Date(year, monthIndex + 1, 0).getDate();
}

