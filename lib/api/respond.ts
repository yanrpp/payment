import type { NextApiResponse } from "next";

/**
 * ตอบกลับข้อผิดพลาดแบบมาตรฐานสำหรับ API routes
 *
 * - log รายละเอียด error เต็มรูปแบบฝั่ง server (เห็นใน PM2/console) เสมอ
 * - ส่ง `message` ภาษาไทยที่ปลอดภัยให้ client
 * - แนบ `error` (ข้อความ error ดิบ) เฉพาะตอนไม่ใช่ production เท่านั้น
 *   เพื่อกัน Oracle error leak ชื่อ schema/ตาราง/คอลัมน์ออกไปฝั่ง client ใน prod
 */
export function respondError(
  res: NextApiResponse,
  message: string,
  error: unknown,
  status = 500
): void {
  // eslint-disable-next-line no-console
  console.error(`[API] ${message}:`, error);

  const body: { success: false; message: string; error?: string } = {
    success: false,
    message,
  };

  if (process.env.NODE_ENV !== "production") {
    body.error = error instanceof Error ? error.message : String(error);
  }

  res.status(status).json(body);
}
