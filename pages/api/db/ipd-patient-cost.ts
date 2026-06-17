import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { sqlUnitCost, sqlUnitSale } from "@/lib/db/meditemRateSql";

interface PatientCostRow {
  AN: string;
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  RGTDATE: string;
  PTTYPE_NAME: string | null;
  ITEM_COUNT: number;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
}

type SuccessResponse = { success: true; count: number; data: PatientCostRow[] };
type ErrorResponse = { success: false; message: string; error?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET")
    return res.status(405).json({ success: false, message: "Method not allowed" });
  const { d1, d2, hn, cardno } = req.query;

  if (!d1 || !d2 || typeof d1 !== "string" || typeof d2 !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "กรุณาระบุช่วงวันที่ d1 และ d2 (รูปแบบ YYYY-MM-DD)" });
  }

  const hnValue = typeof hn === "string" && hn.trim() !== "" ? hn.trim() : null;
  const cardnoValue = typeof cardno === "string" && cardno.trim() !== "" ? cardno.trim() : null;
  const whereHn = hnValue != null ? " AND ipt.hn = :hn" : "";
  const whereCardno = cardnoValue != null ? " AND ptno.cardno = :cardno" : "";

  const unitCost = sqlUnitCost("m", "d", "p");
  const unitSale = sqlUnitSale("m", "d", "p");

  // 1 AN = 1 แถว — ดึงผู้ป่วยที่ admit จริงจากตาราง IPT แล้วรวมต้นทุน/ยอดขายยาของทั้ง Admission
  // ต้นทุน/ราคาขายต่อหน่วยใช้เรตล่าสุดจาก MEDITEMSALEHST (วิธีเดียวกับหน้า drug-cost-summary)
  const sql = `
    WITH base AS (
      SELECT
        ipt.an        AS AN,
        ipt.hn        AS HN,
        ipt.rgtdate   AS RGTDATE,
        ptno.cardno   AS CARDNO,
        pt.dspname    AS DSPNAME,
        pty.name      AS PTTYPE_NAME,
        m.meditem     AS MEDITEM,
        d.qty         AS QTY,
        ${unitCost}   AS UNIT_COST,
        ${unitSale}   AS UNIT_SALE
      FROM ipt
      JOIN pt ON ipt.hn = pt.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      JOIN prsc p ON p.an = ipt.an
      JOIN prscdt d ON d.prscno = p.prscno
      JOIN meditem m ON m.meditem = d.meditem
      LEFT JOIN pttype pty ON pty.pttype = p.pttype
      WHERE ipt.rgtdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
        ${whereHn}
        ${whereCardno}
    )
    SELECT
      AN,
      HN,
      RGTDATE,
      MAX(CARDNO)                         AS CARDNO,
      MAX(DSPNAME)                        AS DSPNAME,
      MAX(PTTYPE_NAME)                    AS PTTYPE_NAME,
      COUNT(DISTINCT MEDITEM)             AS ITEM_COUNT,
      SUM(QTY)                            AS TOTAL_QTY,
      SUM(QTY * UNIT_COST)                AS TOTAL_COST,
      SUM(QTY * UNIT_SALE)                AS TOTAL_SALE,
      SUM(QTY * (UNIT_SALE - UNIT_COST))  AS TOTAL_PROFIT
    FROM base
    GROUP BY
      AN,
      HN,
      RGTDATE
    ORDER BY
      RGTDATE,
      AN
  `;

  const params: Record<string, unknown> = { d1, d2 };

  if (hnValue != null) params.hn = hnValue;
  if (cardnoValue != null) params.cardno = cardnoValue;

  try {
    const result = await executeQuery<PatientCostRow>(sql, params);
    const rows = result.rows ?? [];

    return res.status(200).json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงข้อมูลต้นทุนรายผู้ป่วย (IPD) ได้", error);
  }
}
