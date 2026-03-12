export function normalizeHnInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // ถ้ามีเฉพาะตัวเลข ถือว่าเป็น HN ตามที่เก็บในฐานข้อมูลอยู่แล้ว
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // รองรับรูปแบบ เช่น 1666/69 หรือ 1666-69
  const match = trimmed.match(/^(\d{1,7})[/-](\d{2})$/);
  if (match) {
    const numberPart = match[1]; // เลข running
    const yearSuffix = match[2]; // สองหลักท้ายของปี

    // สมมติรูปแบบในฐานข้อมูล: YY + running (padding ซ้ายเป็น 7 หลัก)
    const paddedNumber = numberPart.padStart(7, "0");
    return `${yearSuffix}${paddedNumber}`;
  }

  // ถ้ามีตัวคั่นอื่น ๆ ให้ดึงเฉพาะตัวเลขมารวมกัน
  const digits = trimmed.replace(/\D/g, "");
  return digits || trimmed;
}

