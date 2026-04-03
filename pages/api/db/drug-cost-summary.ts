import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

type DrugCostSummaryRow = {
  HN: string;
  /** ชื่อสิทธิจาก pttype.name (ผูกจาก prsc.pttype) */
  PTTYPE_NAME: string | null;
  CLINIC_LCT: string | null;
  CLINIC_LCT_NAME: string | null;
  MEDITEM: string;
  MEDTYPE: string | null;
  ACCNATION: string | null;
  DRUG_NAME: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: DrugCostSummaryRow[];
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

  const { d1, d2 } = req.query;

  if (!d1 || !d2 || typeof d1 !== "string" || typeof d2 !== "string") {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุช่วงวันที่ d1 และ d2 (รูปแบบ YYYY-MM-DD)",
    });
  }

  const sql = `
    WITH base AS (
      SELECT
        p.hn                                AS HN,
        d.sphmlct                           AS CLINIC_LCT,
        lct.name                            AS CLINIC_LCT_NAME,
        m.meditem                           AS MEDITEM,
        t.name                              AS MEDTYPE,
        a.name                              AS ACCNATION,
        m.medname                           AS DRUG_NAME,
        d.qty                               AS QTY,
        COALESCE(
          NULLIF(
            (
              SELECT MAX(ms.costrate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
              FROM MEDITEMSALEHST ms
              WHERE ms.meditem = m.meditem
                AND ms.effectdate <= TRUNC(p.prscdate)
            ),
            0
          ),
          (
            SELECT MAX(ms.salerate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
            FROM MEDITEMSALEHST ms
            WHERE ms.meditem = m.meditem
              AND ms.effectdate <= TRUNC(p.prscdate)
          ),
          NULLIF(d.costrate, 0),
          d.salerate
        ) AS UNIT_COST,
        COALESCE(
          (
            SELECT MAX(ms.salerate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
            FROM MEDITEMSALEHST ms
            WHERE ms.meditem = m.meditem
              AND ms.effectdate <= TRUNC(p.prscdate)
          ),
          d.salerate,
          0
        ) AS UNIT_SALE,
        pt.name AS PTTYPE_NAME
      FROM prsc p
        INNER JOIN prscdt d ON p.prscno = d.prscno
        INNER JOIN meditem m ON d.meditem = m.meditem
        INNER JOIN medtype t ON t.medtype = m.medtype
        INNER JOIN medaccnation a ON a.accnation = m.accnation
        LEFT JOIN lct ON d.sphmlct = lct.lct
        LEFT JOIN pttype pt ON pt.pttype = p.pttype
      WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
    )
    SELECT
      HN,
      PTTYPE_NAME,
      CLINIC_LCT,
      CLINIC_LCT_NAME,
      MEDITEM,
      MEDTYPE,
      ACCNATION,
      DRUG_NAME,
      SUM(QTY) AS TOTAL_QTY,
      SUM(QTY * UNIT_COST) AS TOTAL_COST,
      SUM(QTY * UNIT_SALE) AS TOTAL_SALE,
      SUM(QTY * (UNIT_SALE - UNIT_COST)) AS TOTAL_PROFIT
    FROM base
    GROUP BY
      HN,
      PTTYPE_NAME,
      CLINIC_LCT,
      CLINIC_LCT_NAME,
      MEDITEM,
      MEDTYPE,
      ACCNATION,
      DRUG_NAME
    ORDER BY
      MEDITEM,
      DRUG_NAME
  `;

  try {
    const result = await executeQuery<DrugCostSummaryRow>(sql, { d1, d2 });
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
      message: "ไม่สามารถดึงข้อมูลสรุปต้นทุนยาได้",
      error: errorMessage,
    });
  }
}
