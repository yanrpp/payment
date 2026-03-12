export function normalizeThaiCardInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // ดึงเฉพาะตัวเลขออกมาก่อน
  const digits = trimmed.replace(/\D/g, "");

  // บัตรประชาชนไทยควรมี 13 หลัก ถ้าไม่ครบให้คืนเลขที่มีไป (ไม่บังคับตัดทิ้ง)
  if (digits.length !== 13) {
    return digits || trimmed;
  }

  // คืนรูปแบบมาตรฐาน 13 หลัก (สำหรับใช้ค้นหา / เทียบในฐานข้อมูล)
  return digits;
}

