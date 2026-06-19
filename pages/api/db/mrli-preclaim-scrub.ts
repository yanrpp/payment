import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import {
  evaluateScrub,
  getActiveScrubRules,
  getDefaultActiveScrubRules,
  type ActiveScrubRule,
  type ScrubFinding,
} from "@/lib/db/mrli/scrub";

type ScrubRow = {
  AN: string;
  HN: string;
  RGTDATE: string;
  DSPNAME: string | null;
  CARDNO: string | null;
  PTTYPE_NAME: string | null;
  TOTAL_CHARGE: number;
  DRUG_ORDER_COUNT: number;
  DX_COUNT: number | null;
  NON_FORMULARY_COUNT: number;
  findings: ScrubFinding[];
};

type BaseRow = {
  AN: string;
  HN: string;
  RGTDATE: string;
  DSPNAME: string | null;
  CARDNO: string | null;
  PTTYPE_NAME: string | null;
  TOTAL_CHARGE: number;
  DRUG_ORDER_COUNT: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const sqlBase =
    mode === "ipd"
      ? `
    SELECT
      ipt.an       AS AN,
      ipt.hn       AS HN,
      ipt.rgtdate  AS RGTDATE,
      MAX(pt.dspname)  AS DSPNAME,
      MAX(ptno.cardno) AS CARDNO,
      (SELECT MAX(pty.name) FROM prsc pr JOIN pttype pty ON pty.pttype = pr.pttype WHERE pr.an = ipt.an) AS PTTYPE_NAME,
      NVL(SUM(NVL(ic.incamt, 0)), 0) AS TOTAL_CHARGE,
      (SELECT COUNT(*) FROM prsc pr WHERE pr.an = ipt.an) AS DRUG_ORDER_COUNT
    FROM ipt
    JOIN pt ON ipt.hn = pt.hn
    LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
    LEFT JOIN incpt ic ON ic.an = ipt.an
    WHERE ipt.rgtdate ${dateRange}${pttypeFilter}
    GROUP BY ipt.an, ipt.hn, ipt.rgtdate
    ORDER BY ipt.rgtdate, ipt.an
  `
      : `
    SELECT
      ov.hn || ':' || TO_CHAR(ov.vstdate, 'YYYYMMDD') AS AN,
      ov.hn        AS HN,
      ov.vstdate   AS RGTDATE,
      MAX(pt.dspname)  AS DSPNAME,
      MAX(ptno.cardno) AS CARDNO,
      (SELECT MAX(pty.name)
         FROM incpt i
         INNER JOIN ovst o2 ON o2.hn = i.hn AND o2.fn = i.fn AND o2.vn = i.vn
         LEFT JOIN pttype pty ON pty.pttype = i.pttype
        WHERE o2.hn = ov.hn AND o2.vstdate = ov.vstdate AND o2.an IS NULL AND o2.canceldate IS NULL) AS PTTYPE_NAME,
      NVL(SUM(NVL(ic.incamt, 0)), 0) AS TOTAL_CHARGE,
      (SELECT COUNT(*) FROM prsc pr INNER JOIN ovst o3 ON o3.vn = pr.vn
        WHERE o3.hn = ov.hn AND o3.vstdate = ov.vstdate AND o3.an IS NULL) AS DRUG_ORDER_COUNT
    FROM ovst ov
    JOIN pt ON ov.hn = pt.hn
    LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
    LEFT JOIN incpt ic ON ic.hn = ov.hn AND ic.fn = ov.fn AND ic.vn = ov.vn
    WHERE ov.vstdate ${dateRange}
      AND ov.an IS NULL
      AND ov.canceldate IS NULL${pttypeFilter}
    GROUP BY ov.hn, ov.vstdate
    ORDER BY ov.vstdate, ov.hn
  `;

  // ยานอกบัญชียาหลัก ต่อ visit (เชื่อถือได้)
  const sqlNonFormulary =
    mode === "ipd"
      ? `SELECT ipt.an AS AN, COUNT(DISTINCT m.meditem) AS CNT
         FROM ipt
         JOIN prsc p ON p.an = ipt.an
         JOIN prscdt d ON d.prscno = p.prscno
         JOIN meditem m ON m.meditem = d.meditem
         LEFT JOIN medaccnation a ON a.accnation = m.accnation
         WHERE ipt.rgtdate ${dateRange} AND a.name LIKE 'ยานอก%'
         GROUP BY ipt.an`
      : `SELECT ov.hn || ':' || TO_CHAR(ov.vstdate, 'YYYYMMDD') AS AN, COUNT(DISTINCT m.meditem) AS CNT
         FROM ovst ov
         JOIN prsc p ON p.vn = ov.vn
         JOIN prscdt d ON d.prscno = p.prscno
         JOIN meditem m ON m.meditem = d.meditem
         LEFT JOIN medaccnation a ON a.accnation = m.accnation
         WHERE ov.vstdate ${dateRange} AND ov.an IS NULL AND a.name LIKE 'ยานอก%'
         GROUP BY ov.hn, ov.vstdate`;

  const sqlDx =
    mode === "ipd"
      ? `SELECT id.an AS AN, COUNT(*) AS CNT
         FROM iptdiag id JOIN ipt ON ipt.an = id.an
         WHERE ipt.rgtdate ${dateRange} GROUP BY id.an`
      : `SELECT ov.hn || ':' || TO_CHAR(ov.vstdate, 'YYYYMMDD') AS AN, COUNT(*) AS CNT
         FROM ovstdiag od JOIN ovst ov ON ov.vn = od.vn
         WHERE ov.vstdate ${dateRange} AND ov.an IS NULL
         GROUP BY ov.hn, ov.vstdate`;

  try {
    const [baseResult, nfResult] = await Promise.all([
      executeQuery<BaseRow>(sqlBase, params),
      executeQuery<{ AN: string; CNT: number }>(sqlNonFormulary, params),
    ]);
    const baseRows = baseResult.rows ?? [];

    const nfMap = new Map<string, number>();

    for (const r of nfResult.rows ?? []) nfMap.set(String(r.AN), Number(r.CNT ?? 0));

    // Dx — defensive
    const dxMap = new Map<string, number>();
    let dxAvailable = false;

    try {
      const dxResult = await executeQuery<{ AN: string; CNT: number }>(sqlDx, params);

      dxAvailable = true;
      for (const r of dxResult.rows ?? []) dxMap.set(String(r.AN), Number(r.CNT ?? 0));
    } catch {
      // ตาราง diagnosis อาจไม่มี — กฎ NO_DIAGNOSIS จะถูกข้าม
    }

    // โหลดกฎที่เปิดใช้งานจาก mrli_rule; ถ้า MySQL ไม่พร้อมใช้กฎ default
    let activeRules: ActiveScrubRule[];
    let rulesFromStore = false;

    try {
      activeRules = await getActiveScrubRules();
      rulesFromStore = true;
    } catch {
      activeRules = getDefaultActiveScrubRules();
    }

    const data: ScrubRow[] = baseRows.map((r) => {
      const an = String(r.AN);
      const dxCount = dxAvailable ? (dxMap.get(an) ?? 0) : null;
      const nonFormularyCount = nfMap.get(an) ?? 0;
      const findings = evaluateScrub(
        {
          totalCharge: Number(r.TOTAL_CHARGE ?? 0),
          dxCount,
          nonFormularyCount,
          drugOrderCount: Number(r.DRUG_ORDER_COUNT ?? 0),
        },
        activeRules
      );

      return { ...r, DX_COUNT: dxCount, NON_FORMULARY_COUNT: nonFormularyCount, findings };
    });

    const summary = {
      total: data.length,
      withFindings: data.filter((r) => r.findings.length > 0).length,
      error: data.filter((r) => r.findings.some((f) => f.severity === "error")).length,
      warning: data.filter((r) => r.findings.some((f) => f.severity === "warning")).length,
    };

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
      summary,
      meta: { mode, dxAvailable, rulesFromStore },
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถรัน Pre-Claim Scrubbing ได้", error);
  }
}
