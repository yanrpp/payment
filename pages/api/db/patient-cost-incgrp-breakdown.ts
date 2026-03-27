import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

/** สรุปยอดตามหมวด — INCPT → INCOME → INCGRP (แสดงชื่อจาก incgrp.name) */
export type PatientCostIncgrpBreakdownRow = {
  INCGRP: number;
  INCGRP_NAME: string | null;
  AMOUNT: number;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientCostIncgrpBreakdownRow[];
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { hn, vstdate } = req.query;

  if (!hn || !vstdate || typeof hn !== "string" || typeof vstdate !== "string") {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุ hn และ vstdate (รูปแบบ YYYY-MM-DD)",
    });
  }

  /* ผูกกับ ovst แบบเดียวกับ patient-cost / patient-cost-detail (hn+fn+vn) */
  const sql = `
    SELECT
      g.incgrp AS INCGRP,
      MAX(g.name) AS INCGRP_NAME,
      SUM(NVL(i.incamt, 0)) AS AMOUNT
    FROM ovst ov
    INNER JOIN incpt i
      ON i.hn = ov.hn
     AND i.fn = ov.fn
     AND i.vn = ov.vn
    LEFT JOIN income inc ON i.income = inc.income
    LEFT JOIN incgrp g ON inc.incgrp = g.incgrp
    WHERE ov.hn = :hn
      AND ov.vstdate = TO_DATE(:vstdate, 'YYYY-MM-DD')
      AND ov.an IS NULL
      AND ov.canceldate IS NULL
      AND i.an IS NULL
      AND g.incgrp IS NOT NULL
    GROUP BY g.incgrp
    HAVING SUM(NVL(i.incamt, 0)) > 0
    ORDER BY g.incgrp
  `;

  try {
    const result = await executeQuery<PatientCostIncgrpBreakdownRow>(sql, {
      hn: hn.trim(),
      vstdate: vstdate.trim(),
    });
    const rows = result.rows ?? [];

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถดึงสรุปหมวด INCGRP ได้ (ตรวจสอบคอลัมน์ incgrp.name)",
      error: errorMessage,
    });
  }
}
