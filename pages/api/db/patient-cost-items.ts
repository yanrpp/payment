import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

type PatientCostItemRow = {
  HN: string;
  INCDATE: string;
  INCOME: string | null;
  INCOMENAME: string | null;
  INCGRP: number | null;
  QTY: number | null;
  PRICE: number | null;
  INCAMT: number;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientCostItemRow[];
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

  const sql = `
    SELECT
      incpt.hn                          AS HN,
      incpt.incdate                     AS INCDATE,
      incpt.income                      AS INCOME,
      income.dspname                    AS INCOMENAME,
      incgrp.incgrp                     AS INCGRP,
      incpt.qty                         AS QTY,
      incpt.price                       AS PRICE,
      incpt.incamt                      AS INCAMT
    FROM incpt
    LEFT JOIN income ON incpt.income = income.income
    LEFT JOIN incgrp ON income.incgrp = incgrp.incgrp
    WHERE incpt.hn = :hn
      AND incpt.incdate = TO_DATE(:vstdate, 'YYYY-MM-DD')
      AND incpt.an IS NULL
    ORDER BY
      incgrp.incgrp,
      income.dspname,
      incpt.income
  `;

  try {
    const result = await executeQuery<PatientCostItemRow>(sql, {
      hn: hn.trim(),
      vstdate: vstdate.trim(),
    });

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
      message: "ไม่สามารถดึงรายละเอียดรายการค่าใช้จ่ายได้",
      error: errorMessage,
    });
  }
}

