import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { sqlUnitCost, sqlUnitSale } from "@/lib/db/meditemRateSql";

type DrugItemRow = {
  MEDITEM: string;
  DRUG_NAME: string | null;
  MEDTYPE: string | null;
  ACCNATION: string | null;
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

  const unitCost = sqlUnitCost("m", "d", "p");
  const unitSale = sqlUnitSale("m", "d", "p");

  // รายการยา/เวชภัณฑ์ทั้งหมดที่สั่งให้กับ Admission (AN) นี้ รวมทุกวันที่สั่งยา
  // ต้นทุน/ราคาขายต่อหน่วยใช้เรตล่าสุดจาก MEDITEMSALEHST (วิธีเดียวกับหน้า drug-cost-summary)
  const sql = `
    SELECT
      MEDITEM,
      DRUG_NAME,
      MEDTYPE,
      ACCNATION,
      SUM(QTY)                            AS TOTAL_QTY,
      SUM(QTY * UNIT_COST)                AS TOTAL_COST,
      SUM(QTY * UNIT_SALE)                AS TOTAL_SALE,
      SUM(QTY * (UNIT_SALE - UNIT_COST))  AS TOTAL_PROFIT
    FROM (
      SELECT
        m.meditem    AS MEDITEM,
        m.medname    AS DRUG_NAME,
        t.name       AS MEDTYPE,
        a.name       AS ACCNATION,
        d.qty        AS QTY,
        ${unitCost}  AS UNIT_COST,
        ${unitSale}  AS UNIT_SALE
      FROM prsc p
      JOIN prscdt d ON d.prscno = p.prscno
      JOIN meditem m ON m.meditem = d.meditem
      LEFT JOIN medtype t ON t.medtype = m.medtype
      LEFT JOIN medaccnation a ON a.accnation = m.accnation
      WHERE p.an = :an
    )
    GROUP BY
      MEDITEM,
      DRUG_NAME,
      MEDTYPE,
      ACCNATION
    ORDER BY
      DRUG_NAME
  `;

  try {
    const result = await executeQuery<DrugItemRow>(sql, { an: an.trim() });
    const rows = result.rows ?? [];

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงรายการยาของ AN ได้", error);
  }
}
