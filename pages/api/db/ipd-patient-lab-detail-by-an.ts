import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

type LabDetailRow = {
  ORDER_NO: string | null;
  LAB_NAME: string | null;
  RESULT: string | null;
};

type SuccessResponse = { success: true; count: number; data: LabDetailRow[] };
type ErrorResponse = { success: false; message: string; error?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET")
    return res.status(405).json({ success: false, message: "Method not allowed" });
  const { an } = req.query;

  if (!an || typeof an !== "string") {
    return res.status(400).json({ success: false, message: "กรุณาระบุ AN" });
  }

  // รายการตรวจ Lab/พยาธิจริงของ Admission (AN) จากโมดูล Lab ของ HosXP
  // lab_head ผูกด้วย an, lab_order มีชื่อรายการตรวจ (lab_items_name) + ผล
  const sql = `
    SELECT
      lh.lab_order_number AS ORDER_NO,
      lo.lab_items_name   AS LAB_NAME,
      lo.lab_order_result AS RESULT
    FROM lab_head lh
    JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
    WHERE lh.an = :an
      AND lo.lab_items_name IS NOT NULL
    ORDER BY
      lh.lab_order_number,
      lo.lab_items_name
  `;

  try {
    const result = await executeQuery<LabDetailRow>(sql, { an: an.trim() });
    const rows = result.rows ?? [];

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงรายการตรวจ Lab ของ AN ได้", error);
  }
}
