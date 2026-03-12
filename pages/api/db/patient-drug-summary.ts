import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

type PatientDrugSummaryRow = {
  CLINIC_LCT: string | null;
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

  const sql = `
    SELECT
      d.sphmlct                                       AS CLINIC_LCT,
      TRUNC(p.prscdate)                              AS ORDER_DATE,
      m.meditem                                      AS MEDITEM,
      t.name                                         AS MEDTYPE,
      a.name                                         AS ACCNATION,
      m.medname                                      AS DRUG_NAME,
      SUM(d.qty)                                     AS TOTAL_QTY,
      SUM(d.qty * d.costrate)                        AS TOTAL_COST,
      SUM(d.qty * d.salerate)                        AS TOTAL_SALE,
      SUM(d.qty * d.salerate) - SUM(d.qty * d.costrate) AS TOTAL_PROFIT
    FROM prsc p
      INNER JOIN prscdt d ON p.prscno = d.prscno
      INNER JOIN meditem m ON d.meditem = m.meditem
      INNER JOIN medtype t ON t.medtype = m.medtype
      INNER JOIN medaccnation a ON a.accnation = m.accnation
    WHERE p.hn = :hn
      AND TRUNC(p.prscdate) = TO_DATE(:vstdate, 'YYYY-MM-DD')
      AND p.an IS NULL
    GROUP BY
      d.sphmlct,
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

