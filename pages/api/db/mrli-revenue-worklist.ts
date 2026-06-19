import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

/**
 * MRLI เฟส 1 — Revenue Integrity Worklist (รองรับ IPD และ OPD)
 * หาผู้ป่วยที่ยัง "ไม่ครบเงื่อนไขเบิก" เพื่อลด Lost Revenue (อ่าน HosXP อย่างเดียว)
 * - IPD: ยึดจาก ipt (an, rgtdate)  · Dx จาก iptdiag · วันจำหน่าย ipt.dchdate
 * - OPD: ยึดจาก ovst (vn, vstdate, an NULL) · Dx จาก ovstdiag · ไม่มีวันจำหน่าย
 * คอลัมน์ AN ในผลลัพธ์ = ตัวระบุ visit (an สำหรับ IPD / vn สำหรับ OPD)
 */
type WorklistRow = {
  AN: string;
  HN: string;
  RGTDATE: string;
  DSPNAME: string | null;
  CARDNO: string | null;
  PTTYPE_NAME: string | null;
  TOTAL_CHARGE: number;
  CHARGE_ITEM_COUNT: number;
  DRUG_ORDER_COUNT: number;
  DX_COUNT: number | null;
  DCH_DATE: string | null;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: WorklistRow[];
  meta: { mode: "opd" | "ipd"; dxAvailable: boolean; dischargeAvailable: boolean };
};
type ErrorResponse = { success: false; message: string; error?: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET")
    return res.status(405).json({ success: false, message: "Method not allowed" });
  const { d1, d2 } = req.query;

  if (!d1 || !d2 || typeof d1 !== "string" || typeof d2 !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "กรุณาระบุช่วงวันที่ d1 และ d2 (รูปแบบ YYYY-MM-DD)" });
  }

  const mode = String(req.query.mode ?? "ipd").toLowerCase() === "opd" ? "opd" : "ipd";
  const params = { d1, d2 };
  const dateRange = "BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')";

  const sqlBase =
    mode === "ipd"
      ? `
    SELECT
      ipt.an        AS AN,
      ipt.hn        AS HN,
      ipt.rgtdate   AS RGTDATE,
      MAX(pt.dspname)  AS DSPNAME,
      MAX(ptno.cardno) AS CARDNO,
      (SELECT MAX(pty.name) FROM prsc pr JOIN pttype pty ON pty.pttype = pr.pttype WHERE pr.an = ipt.an) AS PTTYPE_NAME,
      NVL(SUM(NVL(ic.incamt, 0)), 0) AS TOTAL_CHARGE,
      COUNT(ic.income)               AS CHARGE_ITEM_COUNT,
      (SELECT COUNT(*) FROM prsc pr WHERE pr.an = ipt.an) AS DRUG_ORDER_COUNT
    FROM ipt
    JOIN pt ON ipt.hn = pt.hn
    LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
    LEFT JOIN incpt ic ON ic.an = ipt.an
    WHERE ipt.rgtdate ${dateRange}
    GROUP BY ipt.an, ipt.hn, ipt.rgtdate
    ORDER BY ipt.rgtdate, ipt.an
  `
      : `
    SELECT
      ov.vn         AS AN,
      ov.hn         AS HN,
      ov.vstdate    AS RGTDATE,
      MAX(pt.dspname)  AS DSPNAME,
      MAX(ptno.cardno) AS CARDNO,
      (SELECT MAX(pty.name) FROM incpt i LEFT JOIN pttype pty ON pty.pttype = i.pttype
        WHERE i.hn = ov.hn AND i.fn = ov.fn AND i.vn = ov.vn) AS PTTYPE_NAME,
      NVL(SUM(NVL(ic.incamt, 0)), 0) AS TOTAL_CHARGE,
      COUNT(ic.income)               AS CHARGE_ITEM_COUNT,
      (SELECT COUNT(*) FROM prsc pr WHERE pr.vn = ov.vn) AS DRUG_ORDER_COUNT
    FROM ovst ov
    JOIN pt ON ov.hn = pt.hn
    LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
    LEFT JOIN incpt ic ON ic.hn = ov.hn AND ic.fn = ov.fn AND ic.vn = ov.vn
    WHERE ov.vstdate ${dateRange}
      AND ov.an IS NULL
      AND ov.canceldate IS NULL
    GROUP BY ov.vn, ov.hn, ov.vstdate
    ORDER BY ov.vstdate, ov.vn
  `;

  const sqlDx =
    mode === "ipd"
      ? `SELECT id.an AS AN, COUNT(*) AS CNT
         FROM iptdiag id JOIN ipt ON ipt.an = id.an
         WHERE ipt.rgtdate ${dateRange} GROUP BY id.an`
      : `SELECT od.vn AS AN, COUNT(*) AS CNT
         FROM ovstdiag od JOIN ovst ov ON ov.vn = od.vn
         WHERE ov.vstdate ${dateRange} AND ov.an IS NULL GROUP BY od.vn`;

  try {
    const baseResult = await executeQuery<Omit<WorklistRow, "DX_COUNT" | "DCH_DATE">>(
      sqlBase,
      params
    );
    const baseRows = baseResult.rows ?? [];

    // Dx — defensive (iptdiag / ovstdiag อาจไม่มีในบาง schema)
    const dxMap = new Map<string, number>();
    let dxAvailable = false;

    try {
      const dxResult = await executeQuery<{ AN: string; CNT: number }>(sqlDx, params);

      dxAvailable = true;
      for (const r of dxResult.rows ?? []) dxMap.set(String(r.AN), Number(r.CNT ?? 0));
    } catch {
      // ตาราง diagnosis อาจไม่มี — ปล่อยเป็น unknown
    }

    // วันจำหน่าย — เฉพาะ IPD (ipt.dchdate) แบบ defensive
    const dchMap = new Map<string, string | null>();
    let dischargeAvailable = false;

    if (mode === "ipd") {
      try {
        const dchResult = await executeQuery<{ AN: string; DCHDATE: string | null }>(
          `SELECT an AS AN, dchdate AS DCHDATE FROM ipt WHERE rgtdate ${dateRange}`,
          params
        );

        dischargeAvailable = true;
        for (const r of dchResult.rows ?? []) dchMap.set(String(r.AN), r.DCHDATE ?? null);
      } catch {
        // คอลัมน์ dchdate อาจชื่ออื่น — ปล่อยเป็น unknown
      }
    }

    const data: WorklistRow[] = baseRows.map((r) => {
      const an = String(r.AN);

      return {
        ...r,
        DX_COUNT: dxAvailable ? (dxMap.get(an) ?? 0) : null,
        DCH_DATE: dischargeAvailable ? (dchMap.get(an) ?? null) : null,
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
      meta: { mode, dxAvailable, dischargeAvailable },
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงรายการ Revenue Integrity Worklist ได้", error);
  }
}
