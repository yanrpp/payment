import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

type ChargeRow = {
  INCGRP: number | null;
  INCGRP_NAME: string | null;
  INCOME: string | null;
  INCOME_NAME: string | null;
  ITEM_COUNT: number;
  AMOUNT: number;
};

type SuccessResponse = { success: true; count: number; data: ChargeRow[] };
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

  // ค่าใช้จ่ายทุกหมวดของ Admission (AN) จากรายการเรียกเก็บ INCPT
  // รวมเป็นรายการต่อ income แล้วจัดกลุ่มตามหมวด (incgrp) เพื่อนำไปแยกแท็บฝั่งหน้าเว็บ
  const sql = `
    SELECT
      g.incgrp              AS INCGRP,
      MAX(g.name)           AS INCGRP_NAME,
      i.income              AS INCOME,
      MAX(inc.name)         AS INCOME_NAME,
      COUNT(*)              AS ITEM_COUNT,
      SUM(NVL(i.incamt, 0)) AS AMOUNT
    FROM incpt i
    LEFT JOIN income inc ON i.income = inc.income
    LEFT JOIN incgrp g ON inc.incgrp = g.incgrp
    WHERE i.an = :an
    GROUP BY
      g.incgrp,
      i.income
    HAVING SUM(NVL(i.incamt, 0)) <> 0
    ORDER BY
      g.incgrp,
      MAX(inc.name)
  `;

  try {
    const result = await executeQuery<ChargeRow>(sql, { an: an.trim() });
    const rows = result.rows ?? [];

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงค่าใช้จ่ายทุกหมวดของ AN ได้", error);
  }
}
