/**
 * Helper สำหรับฟิลเตอร์ตัวเลือกแบบข้อความ (สิทธิ/คลินิก/ประเภทยา ฯลฯ)
 * ใช้ร่วมกันในหลายหน้ารายงาน เพื่อไม่ให้ logic ซ้ำกันในแต่ละไฟล์
 */

/** Oracle / JSON อาจส่งค่าเป็นตัวเลข — normalize เป็น string ตัวพิมพ์เล็กก่อนเปรียบเทียบ */
export function normalizeFieldForFilter(value: unknown): string {
  if (value === null || value === undefined) return "";

  return String(value).toLowerCase();
}

/** กรองรายการตัวเลือกหลายค่าตามข้อความค้นหา (case-insensitive, substring) */
export function filterStringOptions(options: string[], query: string): string[] {
  const trimmed = query.trim();

  if (!trimmed) return options;
  const needle = normalizeFieldForFilter(trimmed);

  return options.filter((opt) => normalizeFieldForFilter(opt).includes(needle));
}
