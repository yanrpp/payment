import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

interface PatientCostRow {
  AN: string;
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  RGTDATE: string;
  PTTYPE_NAME: string | null;
  ITEM_COUNT: number;
  TOTAL_QTY: number;
  TOTAL_SALE: number;
  TOTAL_COST: number;
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

  // 1 AN = 1 แถว — รวมต้นทุน/ยอดขายของยาทั้งหมดในแต่ละ Admission (AN)
  const sql = `
    SELECT
      ipt.an                              AS AN,
      ipt.hn                              AS HN,
      MAX(ptno.cardno)                    AS CARDNO,
      MAX(pt.dspname)                     AS DSPNAME,
      ipt.rgtdate                         AS RGTDATE,
      MAX(pty.name)                       AS PTTYPE_NAME,
      COUNT(DISTINCT prscdt.meditem)      AS ITEM_COUNT,
      SUM(prscdt.qty)                     AS TOTAL_QTY,
      SUM(prscdt.qty * prscdt.salerate)   AS TOTAL_SALE,
      SUM(prscdt.qty * prscdt.costrate)   AS TOTAL_COST
    FROM ipt
    JOIN pt ON ipt.hn = pt.hn
    LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
    JOIN prsc ON ipt.an = prsc.an
    JOIN prscdt ON prsc.prscno = prscdt.prscno
    LEFT JOIN pttype pty ON pty.pttype = prsc.pttype
    WHERE ipt.rgtdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
      ${whereHn}
      ${whereCardno}
    GROUP BY
      ipt.an,
      ipt.hn,
      ipt.rgtdate
    ORDER BY
      ipt.rgtdate,
      ipt.an
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
