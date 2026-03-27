import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

/** รายละเอียดต้นทุนต่อเคส แยกตามหมวดค่าใช้จ่าย incgrp (ไม่ใช้ ICD10) */
export interface PatientCostDetailRow {
  FLG: string;
  ICD10: string;
  ICD9CM: string | null;
  ICD10NAME: string;
  KON: number;
  TOTAL: number;
  ห้อง: number;
  อาหาร: number;
  อวัยวะเทียม: number;
  ยาใน: number;
  ยานอก: number;
  ยาเคมี: number;
  อาหารทางเส้นเลือด: number;
  ยาที่นำไปใช้ต่อที่บ้าน: number;
  เวชภัณฑ์ที่มิใช่ยา: number;
  บริการโลหิต: number;
  พยาธิวิทยา: number;
  รังสีวิทยา: number;
  วินิจฉัยโดยวิธีพิเศษ: number;
  อุปกรณ์ของใช้และเครื่องมือ: number;
  หัตถการ: number;
  ทันตกรรม: number;
  กายภาพบำบัด: number;
  บริการทางการพยาบาล: number;
  บริการทางการแพทย์: number;
  บริการฝังเข็ม: number;
}

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientCostDetailRow[];
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
      1                              AS flg,
      'ทั้งหมด'                      AS icd10,
      NULL                           AS icd9cm,
      'ทั้งหมด'                      AS icd10name,
      COUNT(DISTINCT z.a)             AS kon,
      NVL(SUM(z.b), 0)                AS total,
      NVL(SUM(CASE WHEN z.incgrp = 11 THEN z.b ELSE 0 END), 0) AS "ห้อง",
      NVL(SUM(CASE WHEN z.incgrp = 12 THEN z.b ELSE 0 END), 0) AS "อาหาร",
      NVL(SUM(CASE WHEN z.incgrp = 20 THEN z.b ELSE 0 END), 0) AS "อวัยวะเทียม",
      NVL(SUM(CASE WHEN z.incgrp = 31 THEN z.b ELSE 0 END), 0) AS "ยาใน",
      NVL(SUM(CASE WHEN z.incgrp = 32 THEN z.b ELSE 0 END), 0) AS "ยานอก",
      NVL(SUM(CASE WHEN z.incgrp = 33 THEN z.b ELSE 0 END), 0) AS "ยาเคมี",
      NVL(SUM(CASE WHEN z.incgrp = 34 THEN z.b ELSE 0 END), 0) AS "อาหารทางเส้นเลือด",
      NVL(SUM(CASE WHEN z.incgrp = 40 THEN z.b ELSE 0 END), 0) AS "ยาที่นำไปใช้ต่อที่บ้าน",
      NVL(SUM(CASE WHEN z.incgrp = 50 THEN z.b ELSE 0 END), 0) AS "เวชภัณฑ์ที่มิใช่ยา",
      NVL(SUM(CASE WHEN z.incgrp = 60 THEN z.b ELSE 0 END), 0) AS "บริการโลหิต",
      NVL(SUM(CASE WHEN z.incgrp = 70 THEN z.b ELSE 0 END), 0) AS "พยาธิวิทยา",
      NVL(SUM(CASE WHEN z.incgrp = 80 THEN z.b ELSE 0 END), 0) AS "รังสีวิทยา",
      NVL(SUM(CASE WHEN z.incgrp = 90 THEN z.b ELSE 0 END), 0) AS "วินิจฉัยโดยวิธีพิเศษ",
      NVL(SUM(CASE WHEN z.incgrp = 100 THEN z.b ELSE 0 END), 0) AS "อุปกรณ์ของใช้และเครื่องมือ",
      NVL(SUM(CASE WHEN z.incgrp = 110 THEN z.b ELSE 0 END), 0) AS "หัตถการ",
      NVL(SUM(CASE WHEN z.incgrp = 120 THEN z.b ELSE 0 END), 0) AS "ทันตกรรม",
      NVL(SUM(CASE WHEN z.incgrp = 130 THEN z.b ELSE 0 END), 0) AS "กายภาพบำบัด",
      NVL(SUM(CASE WHEN z.incgrp = 140 THEN z.b ELSE 0 END), 0) AS "บริการทางการพยาบาล",
      NVL(SUM(CASE WHEN z.incgrp = 149 THEN z.b ELSE 0 END), 0) AS "บริการทางการแพทย์",
      NVL(SUM(CASE WHEN z.incgrp = 150 THEN z.b ELSE 0 END), 0) AS "บริการฝังเข็ม"
    FROM (
      /* ให้ตรงกับ patient-cost: ผูก incpt กับ ovst ตาม hn+fn+vn (ไม่ใช้แค่ incdate เพราะอาจไม่ตรงกับ vstdate) */
      SELECT
        incgrp.incgrp     AS incgrp,
        incpt.hn          AS a,
        NVL(incpt.incamt, 0) AS b
      FROM ovst ov
      INNER JOIN incpt incpt
        ON incpt.hn = ov.hn
       AND incpt.fn = ov.fn
       AND incpt.vn = ov.vn
      LEFT OUTER JOIN income ON incpt.income = income.income
      LEFT OUTER JOIN incgrp  ON income.incgrp = incgrp.incgrp
      WHERE ov.hn = :hn
        AND ov.vstdate = TO_DATE(:vstdate, 'YYYY-MM-DD')
        AND ov.an IS NULL
        AND ov.canceldate IS NULL
    ) z
  `;

  try {
    const result = await executeQuery<PatientCostDetailRow>(sql, {
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
      message: "ไม่สามารถดึงรายละเอียดต้นทุนต่อเคสได้",
      error: errorMessage,
    });
  }
}
