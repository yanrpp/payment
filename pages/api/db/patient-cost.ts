import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

interface PatientCostRow {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  VSTDATE: string;
  TOTAL_AMOUNT: number;
  /** รวมค่าใช้จ่าย Lab (incpt หมวดพยาธิวิทยา incgrp=70) */
  LAB_AMOUNT: number;
}

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientCostRow[];
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

  const { d1, d2, hn, cardno } = req.query;

  if (!d1 || !d2 || typeof d1 !== "string" || typeof d2 !== "string") {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุช่วงวันที่ d1 และ d2 (รูปแบบ YYYY-MM-DD)",
    });
  }

  const hnValue = typeof hn === "string" && hn.trim() !== "" ? hn.trim() : null;
  const cardnoValue =
    typeof cardno === "string" && cardno.trim() !== "" ? cardno.trim() : null;

  const whereHn = hnValue != null ? " AND ovst.hn = :hn" : "";
  const whereCardno = cardnoValue != null ? " AND ptno.cardno = :cardno" : "";

  /* รวมค่าใช้จ่ายทั้งหมดต่อ 1 คนต่อ 1 วัน; LAB_AMOUNT = ค่าใช้จ่าย Lab (incgrp=70 พยาธิวิทยา) */
  const sql = `
    SELECT
      ovst.hn           AS HN,
      ptno.cardno       AS CARDNO,
      pt.dspname        AS DSPNAME,
      ovst.vstdate      AS VSTDATE,
      SUM(incpt.incamt) AS TOTAL_AMOUNT,
      SUM(CASE WHEN incgrp.incgrp = 70 THEN incpt.incamt ELSE 0 END) AS LAB_AMOUNT
    FROM ovst
    LEFT JOIN incpt
      ON incpt.hn = ovst.hn
     AND incpt.fn = ovst.fn
     AND incpt.vn = ovst.vn
    LEFT JOIN income ON incpt.income = income.income
    LEFT JOIN incgrp ON income.incgrp = incgrp.incgrp
    JOIN pt
      ON ovst.hn = pt.hn
    LEFT JOIN ptno
      ON pt.hn = ptno.hn
     AND ptno.notype = 10
    WHERE ovst.vstdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
      AND ovst.an IS NULL
      AND ovst.canceldate IS NULL
      ${whereHn}
      ${whereCardno}
    GROUP BY
      ovst.hn,
      ptno.cardno,
      pt.dspname,
      ovst.vstdate
    ORDER BY
      ovst.vstdate,
      ovst.hn
  `;

  const params: Record<string, unknown> = { d1, d2 };
  if (hnValue != null) params.hn = hnValue;
  if (cardnoValue != null) params.cardno = cardnoValue;

  try {
    const result = await executeQuery<PatientCostRow>(sql, params);

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
      message: "ไม่สามารถดึงข้อมูลต้นทุนรายผู้ป่วยได้",
      error: errorMessage,
    });
  }
}

