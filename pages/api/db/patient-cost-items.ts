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
  /** ราคาขายมาตรฐานต่อหน่วย — ผูกคอลัมน์ใน SQL เมื่อทราบชื่อฟิลด์ใน income */
  SALE_PRICE: number | null;
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
      i.hn                              AS HN,
      i.incdate                         AS INCDATE,
      i.income                          AS INCOME,
      inc.name                          AS INCOMENAME,
      g.incgrp                          AS INCGRP,
      NULL                              AS QTY,
      NULL                              AS PRICE,
      CAST(NULL AS NUMBER)              AS SALE_PRICE,
      i.incamt                          AS INCAMT
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
    ORDER BY
      g.incgrp,
      inc.name,
      i.income
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

