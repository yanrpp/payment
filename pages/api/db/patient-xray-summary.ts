import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

type PatientXraySummaryRow = {
  HN: string;
  VSTDATE: string;
  HAS_XRAY: number;
  HAS_HPV4: number;
  HAS_HPV9: number;
  HAS_FLU_VACCINE: number;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientXraySummaryRow[];
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
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const { hn, vstdate } = req.query;

  if (!hn || !vstdate || typeof hn !== "string" || typeof vstdate !== "string") {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุ hn และ vstdate (รูปแบบ YYYY-MM-DD)",
    });
  }

  const params = { hn: hn.trim(), vstdate: vstdate.trim() };

  const sql = `
    SELECT
      :hn AS HN,
      TO_CHAR(TO_DATE(:vstdate, 'YYYY-MM-DD'), 'YYYY-MM-DD') AS VSTDATE,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM rvstexm
          WHERE rvstexm.hn = :hn
            AND rvstexm.rvstdate = TO_DATE(:vstdate, 'YYYY-MM-DD')
            AND rvstexm.rdoexm NOT IN ('00')
        ) THEN 1 ELSE 0
      END AS HAS_XRAY,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM prsc JOIN prscdt ON prsc.prscno = prscdt.prscno
          WHERE prsc.hn = :hn AND TRUNC(prsc.prscdate) = TO_DATE(:vstdate, 'YYYY-MM-DD')
            AND prscdt.meditem IN (5010000463)
        ) THEN 1 ELSE 0
      END AS HAS_HPV4,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM prsc JOIN prscdt ON prsc.prscno = prscdt.prscno
          WHERE prsc.hn = :hn AND TRUNC(prsc.prscdate) = TO_DATE(:vstdate, 'YYYY-MM-DD')
            AND prscdt.meditem IN (5010000464)
        ) THEN 1 ELSE 0
      END AS HAS_HPV9,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM prsc JOIN prscdt ON prsc.prscno = prscdt.prscno
          WHERE prsc.hn = :hn AND TRUNC(prsc.prscdate) = TO_DATE(:vstdate, 'YYYY-MM-DD')
            AND prscdt.meditem IN (5010000109)
        ) THEN 1 ELSE 0
      END AS HAS_FLU_VACCINE
    FROM dual
  `;

  try {
    const result = await executeQuery<PatientXraySummaryRow>(sql, params);
    const rows = result.rows ?? [];

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถดึงสรุป X-ray/Vaccine ต่อเคสได้",
      error: errorMessage,
    });
  }
}
