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

/** วันที่วันนี้ตาม timezone ของเครื่อง (YYYY-MM-DD) */
export function localTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

/** เดือนปัจจุบัน YYYY-MM ตาม timezone ท้องถิ่น */
export function localCurrentMonthIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/** แปลง YYYY-MM เป็นช่วงวันที่ d1–d2 ของเดือนนั้น (เดือนปัจจุบันจบที่วันนี้) */
export function monthIsoToDateRange(monthIso: string): { d1: string; d2: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthIso.trim());
  if (!match) {
    const today = localTodayIso();
    return { d1: today, d2: today };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!year || month < 1 || month > 12) {
    const today = localTodayIso();
    return { d1: today, d2: today };
  }

  const monthPadded = String(month).padStart(2, "0");
  const d1 = `${year}-${monthPadded}-01`;
  const lastDay = getDaysInMonth(year, month - 1);
  const d2Full = `${year}-${monthPadded}-${String(lastDay).padStart(2, "0")}`;
  const today = localTodayIso();
  return { d1, d2: d2Full > today ? today : d2Full };
}

export function formatMonthIsoThaiDisplay(monthIso: string | null | undefined): string {
  if (!monthIso) return "";
  const match = /^(\d{4})-(\d{2})$/.exec(monthIso.trim());
  if (!match) return monthIso;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) return monthIso;
  return `${THAI_MONTH_SHORT[monthIndex]} ${year + 543}`;
}

export function isValidMonthIso(monthIso: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(monthIso.trim());
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function sortMonthIsos(monthIsos: string[]): string[] {
  const unique = Array.from(new Set(monthIsos.filter(isValidMonthIso)));
  return unique.sort();
}

/** รวมหลายเดือนเป็นช่วง d1–d2 (จากเดือนแรกถึงเดือนสุดท้าย) */
export function monthsIsoToDateRange(monthIsos: string[]): { d1: string; d2: string } {
  const sorted = sortMonthIsos(monthIsos);
  if (sorted.length === 0) {
    const today = localTodayIso();
    return { d1: today, d2: today };
  }
  const { d1 } = monthIsoToDateRange(sorted[0]);
  const { d2 } = monthIsoToDateRange(sorted[sorted.length - 1]);
  return { d1, d2 };
}

export function formatMonthsIsoThaiDisplay(monthIsos: string[]): string {
  const sorted = sortMonthIsos(monthIsos);
  if (sorted.length === 0) return "";
  if (sorted.length <= 3) {
    return sorted.map((item) => formatMonthIsoThaiDisplay(item)).join(", ");
  }
  const first = formatMonthIsoThaiDisplay(sorted[0]);
  const last = formatMonthIsoThaiDisplay(sorted[sorted.length - 1]);
  return `${first} – ${last} (รวม ${sorted.length} เดือน)`;
}

