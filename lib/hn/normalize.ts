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

/**
 * แปลง HN ที่เก็บในฐานข้อมูล (เช่น 69 + running) ให้อยู่ในรูปแบบแสดงผล `running/YY`
 * ถ้ามีตัวคั่น (`/` หรือ `-`) อยู่แล้ว ถือว่าเป็นรูปแบบแสดงผลและคืนค่าเดิม
 */
export function formatHnDisplay(value: unknown): string {
  const raw = String(value ?? "").trim();

  if (!raw) return "";
  if (raw.includes("/") || raw.includes("-")) return raw;

  const digits = raw.replace(/\D/g, "");

  if (digits.length < 3) return raw;

  const yearSuffix = digits.slice(0, 2);
  const runningRaw = digits.slice(2);
  const running = runningRaw.replace(/^0+/, "") || "0";

  return `${running}/${yearSuffix}`;
}

/**
 * ตรวจว่า HN ตรงกับข้อความที่ผู้ใช้กรองหรือไม่ — ยืดหยุ่นทั้งรูปแบบดิบ,
 * เฉพาะตัวเลข, รูปแบบแสดงผล (`running/YY`) และรูปแบบที่ normalize แล้ว
 */
export function matchesHnFilter(hnValue: unknown, filterInput: string): boolean {
  const input = filterInput.trim();

  if (!input) return true;

  const raw = String(hnValue ?? "").trim();
  const rawDigits = raw.replace(/\D/g, "");
  const display = formatHnDisplay(raw).toLowerCase();
  const normalizedInput = normalizeHnInput(input);
  const inputDigits = input.replace(/\D/g, "");
  const inputLower = input.toLowerCase();

  return (
    raw.includes(normalizedInput) ||
    rawDigits.includes(inputDigits) ||
    display.includes(inputLower) ||
    raw.toLowerCase().includes(inputLower)
  );
}
