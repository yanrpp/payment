import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

/** ค่าใช้จ่ายต่อรายการ Lab (จาก incpt หมวดพยาธิวิทยา incgrp=70) */
type LabCostItemRow = {
  INCOME: string | null;
  INCOMENAME: string | null;
  QTY: number | null;
  PRICE: number | null;
  /** ราคาขายมาตรฐานต่อหน่วย — ผูกคอลัมน์ใน SQL เมื่อทราบชื่อฟิลด์ใน income */
  SALE_PRICE: number | null;
  INCAMT: number;
};

type PatientLabSummaryRow = {
  HN: string;
  VSTDATE: string;
  LAB_COST_ITEMS: LabCostItemRow[];
  TOTAL_LAB_AMOUNT: number;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientLabSummaryRow[];
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

  /* ค่าใช้จ่ายแต่ละรายการ Lab: incpt หมวดพยาธิวิทยา (incgrp = 70) + ชื่อรายการจาก income.name */
  const sqlLabCostItems = `
    SELECT
      i.income   AS INCOME,
      inc.name   AS INCOMENAME,
      CAST(NULL AS NUMBER) AS QTY,
      CAST(NULL AS NUMBER) AS PRICE,
      CAST(NULL AS NUMBER) AS SALE_PRICE,
      i.incamt   AS INCAMT
    FROM incpt i
    LEFT JOIN income inc ON i.income = inc.income
    LEFT JOIN incgrp ig ON inc.incgrp = ig.incgrp
    WHERE i.hn = :hn
      AND i.incdate = TO_DATE(:vstdate, 'YYYY-MM-DD')
      AND i.an IS NULL
      AND ig.incgrp = 70
    ORDER BY inc.name, i.income
  `;

  try {
    const labCostResult = await executeQuery<LabCostItemRow>(sqlLabCostItems, params);
    const labCostItems = labCostResult.rows ?? [];
    const totalLabAmount = labCostItems.reduce((sum, r) => sum + Number(r.INCAMT ?? 0), 0);

    const row: PatientLabSummaryRow = {
      HN: params.hn,
      VSTDATE: params.vstdate,
      LAB_COST_ITEMS: labCostItems,
      TOTAL_LAB_AMOUNT: totalLabAmount,
    };

    return res.status(200).json({
      success: true,
      count: 1,
      data: [row],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถดึงสรุปค่าใช้จ่าย Lab ต่อเคสได้",
      error: errorMessage,
    });
  }
}
