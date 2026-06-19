import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

/**
 * MRLI เฟส 1 — Revenue Integrity Worklist (รองรับ IPD และ OPD)
 * Performance: ไม่ใช้ correlated subquery ต่อแถว — แยกเป็น query รวม (GROUP BY) แล้ว merge ใน JS
 * - IPD: ยึดจาก ipt (an, rgtdate) · Dx iptdiag · วันจำหน่าย ipt.dchdate · สิทธิจาก prsc.pttype
 * - OPD: ยึดจาก ovst (an NULL) จัดกลุ่ม 1 คน/1 วัน (hn, vstdate) · Dx ovstdiag · สิทธิจาก incpt.pttype
 * คอลัมน์ AN ในผลลัพธ์ = ตัวระบุ (an สำหรับ IPD / "hn:YYYYMMDD" สำหรับ OPD)
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

type BaseRow = {
  AN: string;
  HN: string;
  RGTDATE: string;
  DSPNAME: string | null;
  CARDNO: string | null;
  TOTAL_CHARGE: number;
  CHARGE_ITEM_COUNT: number;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: WorklistRow[];
  meta: { mode: "opd" | "ipd"; dxAvailable: boolean; dischargeAvailable: boolean };
};
type ErrorResponse = { success: false; message: string; error?: string };

const OPD_KEY = "ov.hn || ':' || TO_CHAR(ov.vstdate, 'YYYYMMDD')";

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
  const dateRange = "BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')";

  // กรองสิทธิการรักษา (ฝั่ง server) เพื่อลดข้อมูลก่อนแสดง
  const pttypeRaw = req.query.pttype;
  const pttypeList = (Array.isArray(pttypeRaw) ? pttypeRaw.join("|") : (pttypeRaw ?? ""))
    .toString()
    .split("|")
    .map((v) => v.trim())
    .filter((v) => v !== "");

  const params: Record<string, unknown> = { d1, d2 };
  let pttypeFilter = "";

  if (pttypeList.length > 0) {
    const binds = pttypeList.map((v, i) => {
      params[`pt${i}`] = v;

      return `:pt${i}`;
    });

    pttypeFilter =
      mode === "ipd"
        ? ` AND EXISTS (SELECT 1 FROM prsc pr2 JOIN pttype p2 ON p2.pttype = pr2.pttype WHERE pr2.an = ipt.an AND p2.name IN (${binds.join(", ")}))`
        : ` AND EXISTS (SELECT 1 FROM incpt i2 JOIN pttype p2 ON p2.pttype = i2.pttype WHERE i2.hn = ov.hn AND i2.fn = ov.fn AND i2.vn = ov.vn AND p2.name IN (${binds.join(", ")}))`;
  }

  // --- ส่วนหลัก: admission/visit + ยอดค่าใช้จ่ายรวม (ไม่มี correlated subquery) ---
  const sqlBase =
    mode === "ipd"
      ? `
    SELECT ipt.an AS AN, ipt.hn AS HN, ipt.rgtdate AS RGTDATE,
      MAX(pt.dspname) AS DSPNAME, MAX(ptno.cardno) AS CARDNO,
      NVL(SUM(NVL(ic.incamt, 0)), 0) AS TOTAL_CHARGE, COUNT(ic.income) AS CHARGE_ITEM_COUNT
    FROM ipt
    JOIN pt ON ipt.hn = pt.hn
    LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
    LEFT JOIN incpt ic ON ic.an = ipt.an
    WHERE ipt.rgtdate ${dateRange}${pttypeFilter}
    GROUP BY ipt.an, ipt.hn, ipt.rgtdate
    ORDER BY ipt.rgtdate, ipt.an`
      : `
    SELECT ${OPD_KEY} AS AN, ov.hn AS HN, ov.vstdate AS RGTDATE,
      MAX(pt.dspname) AS DSPNAME, MAX(ptno.cardno) AS CARDNO,
      NVL(SUM(NVL(ic.incamt, 0)), 0) AS TOTAL_CHARGE, COUNT(ic.income) AS CHARGE_ITEM_COUNT
    FROM ovst ov
    JOIN pt ON ov.hn = pt.hn
    LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
    LEFT JOIN incpt ic ON ic.hn = ov.hn AND ic.fn = ov.fn AND ic.vn = ov.vn
    WHERE ov.vstdate ${dateRange} AND ov.an IS NULL AND ov.canceldate IS NULL${pttypeFilter}
    GROUP BY ov.hn, ov.vstdate
    ORDER BY ov.vstdate, ov.hn`;

  // สิทธิการรักษา (รวมต่อ key) — IPD: prsc.pttype · OPD: incpt.pttype
  const sqlPttype =
    mode === "ipd"
      ? `SELECT ipt.an AS K, MAX(pty.name) AS NM
         FROM ipt JOIN prsc pr ON pr.an = ipt.an JOIN pttype pty ON pty.pttype = pr.pttype
         WHERE ipt.rgtdate ${dateRange} GROUP BY ipt.an`
      : `SELECT ${OPD_KEY} AS K, MAX(pty.name) AS NM
         FROM ovst ov JOIN incpt i ON i.hn = ov.hn AND i.fn = ov.fn AND i.vn = ov.vn
           JOIN pttype pty ON pty.pttype = i.pttype
         WHERE ov.vstdate ${dateRange} AND ov.an IS NULL GROUP BY ov.hn, ov.vstdate`;

  // จำนวนใบสั่งยา (รวมต่อ key)
  const sqlDrug =
    mode === "ipd"
      ? `SELECT pr.an AS K, COUNT(*) AS C FROM prsc pr JOIN ipt ON ipt.an = pr.an
         WHERE ipt.rgtdate ${dateRange} GROUP BY pr.an`
      : `SELECT ${OPD_KEY} AS K, COUNT(*) AS C FROM prsc pr JOIN ovst ov ON ov.vn = pr.vn
         WHERE ov.vstdate ${dateRange} AND ov.an IS NULL GROUP BY ov.hn, ov.vstdate`;

  const sqlDx =
    mode === "ipd"
      ? `SELECT id.an AS K, COUNT(*) AS C FROM iptdiag id JOIN ipt ON ipt.an = id.an
         WHERE ipt.rgtdate ${dateRange} GROUP BY id.an`
      : `SELECT ${OPD_KEY} AS K, COUNT(*) AS C FROM ovstdiag od JOIN ovst ov ON ov.vn = od.vn
         WHERE ov.vstdate ${dateRange} AND ov.an IS NULL GROUP BY ov.hn, ov.vstdate`;

  try {
    const [baseResult, pttypeResult, drugResult] = await Promise.all([
      executeQuery<BaseRow>(sqlBase, params),
      executeQuery<{ K: string; NM: string | null }>(sqlPttype, params),
      executeQuery<{ K: string; C: number }>(sqlDrug, params),
    ]);
    const baseRows = baseResult.rows ?? [];

    const pttypeMap = new Map<string, string | null>();

    for (const r of pttypeResult.rows ?? []) pttypeMap.set(String(r.K), r.NM ?? null);

    const drugMap = new Map<string, number>();

    for (const r of drugResult.rows ?? []) drugMap.set(String(r.K), Number(r.C ?? 0));

    // Dx — defensive (iptdiag / ovstdiag อาจไม่มีในบาง schema)
    const dxMap = new Map<string, number>();
    let dxAvailable = false;

    try {
      const dxResult = await executeQuery<{ K: string; C: number }>(sqlDx, params);

      dxAvailable = true;
      for (const r of dxResult.rows ?? []) dxMap.set(String(r.K), Number(r.C ?? 0));
    } catch {
      // ตาราง diagnosis อาจไม่มี — ปล่อยเป็น unknown
    }

    // วันจำหน่าย — เฉพาะ IPD (ipt.dchdate) แบบ defensive
    const dchMap = new Map<string, string | null>();
    let dischargeAvailable = false;

    if (mode === "ipd") {
      try {
        const dchResult = await executeQuery<{ K: string; DCHDATE: string | null }>(
          `SELECT an AS K, dchdate AS DCHDATE FROM ipt WHERE rgtdate ${dateRange}`,
          params
        );

        dischargeAvailable = true;
        for (const r of dchResult.rows ?? []) dchMap.set(String(r.K), r.DCHDATE ?? null);
      } catch {
        // คอลัมน์ dchdate อาจชื่ออื่น — ปล่อยเป็น unknown
      }
    }

    const data: WorklistRow[] = baseRows.map((r) => {
      const k = String(r.AN);

      return {
        ...r,
        PTTYPE_NAME: pttypeMap.get(k) ?? null,
        DRUG_ORDER_COUNT: drugMap.get(k) ?? 0,
        DX_COUNT: dxAvailable ? (dxMap.get(k) ?? 0) : null,
        DCH_DATE: dischargeAvailable ? (dchMap.get(k) ?? null) : null,
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
