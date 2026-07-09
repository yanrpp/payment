/** ตัดรหัสตัวเลขนำหน้าชื่อรายการ Lab จาก HosXP (เช่น 07Albumin → Albumin) */
export function formatLabNameDisplay(name: string | null | undefined): string {
  const text = String(name ?? "").trim();

  if (!text) return "—";

  const stripped = text.replace(/^\d+(?=[A-Za-zก-๙])/, "");

  return stripped || text;
}
