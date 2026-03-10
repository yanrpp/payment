/**
 * ฟังก์ชันสำหรับจัดการค่าวันที่แบบ "date-only" (ไม่มีเวลา)
 * ใช้เพื่อหลีกเลี่ยงปัญหา timezone: ค่าวันที่จาก DB (DATE/ISO midnight) เมื่อแสดงด้วย toLocaleDateString
 * ใน timezone ที่อยู่หลัง UTC จะแสดงน้อยไป 1 วัน
 */

/**
 * แปลงค่าวันที่จาก API/DB เป็นสตริง "YYYY-MM-DD" สำหรับใส่ใน input type="date"
 * กรณีรับ ISO string (มี T) จะแปลงจากเวลา local ของค่าเดิม เพื่อให้ตรงกับวันที่ที่บันทึกใน DB
 */
export function toDateOnlyString(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    // ถ้าเป็น ISO string มี T อยู่ (เช่น 2026-02-07T00:00:00.000Z)
    // ให้แปลงเป็น Date แล้วดึงปี/เดือน/วันจากเวลา local เพื่อให้ตรงกับวันที่ใน DB
    if (trimmed.indexOf("T") !== -1) {
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    // ถ้าเป็น "YYYY-MM-DD" อยู่แล้ว
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const d = value as Date;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * แสดงค่าวันที่แบบ date-only เป็นรูปแบบภาษาไทย (วัน/เดือน/ปี พ.ศ.)
 * ใช้ timezone ตามเครื่องของผู้ใช้ (เช่น Asia/Bangkok) ให้ตรงกับค่าที่เก็บใน DB
 */
export function formatDateThai(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * แสดงค่าวันที่แบบ date-only เป็นรูปแบบภาษาไทย แบบยาว (วัน ที่ เดือน พ.ศ.)
 * ใช้ timezone ตามเครื่องของผู้ใช้ (เช่น Asia/Bangkok) ให้ตรงกับวันที่ใน DB
 */
export function formatDateThaiLong(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** ตัวเลขไทย ๐–๙ */
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

/**
 * แปลงตัวเลขเป็นตัวเลขไทย (เช่น 2569 -> ๒๕๖๙)
 */
export function toThaiNumeral(n: number | string): string {
  const s = String(n);
  return s.replace(/[0-9]/g, (d) => THAI_DIGITS[Number.parseInt(d, 10)] ?? d);
}

/**
 * แสดงค่าวันที่แบบยาวภาษาไทย พร้อมตัวเลขไทย (เช่น วันที่ ๑๒ กุมภาพันธ์ ๒๕๖๙)
 * ใช้สำหรับหัวรายงาน
 */
export function formatDateThaiLongWithThaiNumerals(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const day = d.getDate();
  const month = d.toLocaleDateString("th-TH", { month: "long" });
  const year = d.getFullYear() + 543; // พ.ศ.
  return `วันที่ ${toThaiNumeral(day)} ${month} ${toThaiNumeral(year)}`;
}

/**
 * วันที่และเวลาแบบสากล (เลข 0-9) เช่น 12 ก.พ. 2569 14:30
 */
export function formatDateTimeThai(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const day = d.getDate();
  const month = d.toLocaleDateString("th-TH", { month: "short" });
  const year = d.getFullYear() + 543;
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${h}:${m}`;
}

/**
 * วันที่และเวลาแบบภาษาไทย + เลขไทย (เช่น วันที่ ๑๒ กุมภาพันธ์ ๒๕๖๙ ๑๔:๓๐ น.)
 * ใช้สำหรับบรรทัด "พิมพ์เมื่อ ..." ในรายงาน
 */
export function formatDateTimeThaiForReport(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  const datePart = formatDateThaiLongWithThaiNumerals(d);
  const h = d.getHours();
  const m = d.getMinutes();
  const timePart = `${toThaiNumeral(String(h).padStart(2, "0"))}:${toThaiNumeral(String(m).padStart(2, "0"))} น.`;
  return `${datePart} ${timePart}`;
}

/**
 * ค่าวันที่ "วันนี้" ในรูปแบบ YYYY-MM-DD ตาม timezone ท้องถิ่น
 * ใช้เป็นค่าเริ่มต้นในฟอร์ม (เช่น วันที่รับเรื่อง)
 */
export function getTodayLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
