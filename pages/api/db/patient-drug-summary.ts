import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

type PatientDrugSummaryRow = {
  CLINIC_LCT: string | null;
  CLINIC_LCT_NAME: string | null;
  ORDER_DATE: string;
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
  data: PatientDrugSummaryRow[];
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

  /* ต้นทุน/ราคาขายต่อหน่วย: ใช้ MEDITEMSALEHST ที่ EFFECTDATE ล่าสุดตามวัน vstdate
     - ต้นทุนต่อหน่วย: COALESCE(ms.costrate≠0, ms.salerate, d.costrate≠0, d.salerate) (Oracle NVL รับได้แค่ 2 ค่า)
     - ราคาขายต่อหน่วย: NVL(ms.salerate, d.salerate) */
  const sql = `
    SELECT
      d.sphmlct                                       AS CLINIC_LCT,
      lct.name                                        AS CLINIC_LCT_NAME,
      TRUNC(p.prscdate)                              AS ORDER_DATE,
      m.meditem                                      AS MEDITEM,
      t.name                                         AS MEDTYPE,
      a.name                                         AS ACCNATION,
      m.medname                                      AS DRUG_NAME,
      SUM(d.qty) AS TOTAL_QTY,
      SUM(
        d.qty * COALESCE(
          NULLIF(ms.costrate, 0),
          ms.salerate,
          NULLIF(d.costrate, 0),
          d.salerate
        )
      ) AS TOTAL_COST,
      SUM(d.qty * COALESCE(ms.salerate, d.salerate, 0)) AS TOTAL_SALE,
      SUM(
        d.qty * (
          COALESCE(ms.salerate, d.salerate, 0) -
          COALESCE(
            NULLIF(ms.costrate, 0),
            ms.salerate,
            NULLIF(d.costrate, 0),
            d.salerate,
            0
          )
        )
      ) AS TOTAL_PROFIT
    FROM prsc p
      INNER JOIN prscdt d ON p.prscno = d.prscno
      INNER JOIN meditem m ON d.meditem = m.meditem
      INNER JOIN medtype t ON t.medtype = m.medtype
      INNER JOIN medaccnation a ON a.accnation = m.accnation
      /* เลือก MEDITEMSALEHST ล่าสุดตาม EFFECTDATE (<= วัน vstdate) */
      LEFT JOIN (
        SELECT
          meditem,
          costrate,
          salerate
        FROM (
          SELECT
            meditem,
            costrate,
            salerate,
            ROW_NUMBER() OVER (PARTITION BY meditem ORDER BY effectdate DESC) AS rn
          FROM MEDITEMSALEHST
          WHERE effectdate <= TO_DATE(:vstdate, 'YYYY-MM-DD')
        )
        WHERE rn = 1
      ) ms ON ms.meditem = m.meditem
      LEFT JOIN lct ON d.sphmlct = lct.lct
    WHERE p.hn = :hn
      AND TRUNC(p.prscdate) = TO_DATE(:vstdate, 'YYYY-MM-DD')
      AND p.an IS NULL
    GROUP BY
      d.sphmlct,
      lct.name,
      TRUNC(p.prscdate),
      m.meditem,
      m.medname,
      t.name,
      a.name
    ORDER BY
      d.sphmlct,
      ORDER_DATE,
      m.medname
  `;

  try {
    const result = await executeQuery<PatientDrugSummaryRow>(sql, {
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
      message: "ไม่สามารถดึงรายละเอียดค่ายาต่อเคสได้",
      error: errorMessage,
    });
  }
}
