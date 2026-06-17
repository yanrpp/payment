import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

type DrugItemRow = {
  MEDITEM: string;
  DRUG_NAME: string | null;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
};

type SuccessResponse = { success: true; count: number; data: DrugItemRow[] };
type ErrorResponse = { success: false; message: string; error?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET")
    return res.status(405).json({ success: false, message: "Method not allowed" });
  const { an } = req.query;

  if (!an || typeof an !== "string") {
    return res.status(400).json({ success: false, message: "กรุณาระบุ AN" });
  }

  // รายการยา/เวชภัณฑ์ทั้งหมดที่สั่งให้กับ Admission (AN) นี้ รวมทุกวันที่สั่งยา
  const sql = `
    SELECT
      m.meditem                            AS MEDITEM,
      m.printnm                            AS DRUG_NAME,
      SUM(d.qty)                           AS TOTAL_QTY,
      SUM(d.qty * d.costrate)              AS TOTAL_COST,
      SUM(d.qty * d.salerate)              AS TOTAL_SALE,
      SUM(d.qty * (d.salerate - d.costrate)) AS TOTAL_PROFIT
    FROM prsc p
    JOIN prscdt d ON p.prscno = d.prscno
    JOIN meditem m ON d.meditem = m.meditem
    WHERE p.an = :an
    GROUP BY
      m.meditem,
      m.printnm
    ORDER BY
      m.printnm
  `;

  try {
    const result = await executeQuery<DrugItemRow>(sql, { an: an.trim() });
    const rows = result.rows ?? [];

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงรายการยาของ AN ได้", error);
  }
}
