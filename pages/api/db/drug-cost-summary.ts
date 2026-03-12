import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

type DrugCostSummaryRow = {
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
    SELECT
      m.meditem                           AS MEDITEM,
      t.name                              AS MEDTYPE,
      a.name                              AS ACCNATION,
      m.medname                           AS DRUG_NAME,
      SUM(d.qty)                          AS TOTAL_QTY,
      SUM(d.qty * d.costrate)             AS TOTAL_COST,
      SUM(d.qty * d.salerate)             AS TOTAL_SALE,
      SUM(d.qty * d.salerate) - SUM(d.qty * d.costrate) AS TOTAL_PROFIT
    FROM prsc p
      INNER JOIN prscdt d ON p.prscno = d.prscno
      INNER JOIN meditem m ON d.meditem = m.meditem
      INNER JOIN medtype t ON t.medtype = m.medtype
      INNER JOIN medaccnation a ON a.accnation = m.accnation
    WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
    GROUP BY
      t.name,
      a.name,
      m.meditem,
      m.medname
    ORDER BY
      m.meditem,
      m.medname
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

