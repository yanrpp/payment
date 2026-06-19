import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

/** รายการชื่อสิทธิการรักษาทั้งหมด (เบา) สำหรับตัวกรองก่อนค้นหา MRLI */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET")
    return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const result = await executeQuery<{ NAME: string | null }>(
      `SELECT DISTINCT name AS NAME FROM pttype WHERE name IS NOT NULL ORDER BY name`
    );
    const options = (result.rows ?? [])
      .map((r) => String(r.NAME ?? "").trim())
      .filter((v) => v !== "");

    return res.status(200).json({ success: true, options });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงรายการสิทธิการรักษาได้", error);
  }
}
