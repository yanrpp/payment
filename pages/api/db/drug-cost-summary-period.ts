import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

type GroupBy = "month" | "year";

type DrugCostSummaryPeriodRow = {
  PERIOD_KEY: string;
  PERIOD_LABEL: string;
  TOTAL_ITEM_COUNT: number;
  TOTAL_UNIQUE_ITEM_COUNT: number;
  TOTAL_QTY: number;
  TOTAL_COST: number;
  TOTAL_SALE: number;
  TOTAL_PROFIT: number;
};

type SuccessResponse = {
  success: true;
  count: number;
  uniqueItemCount: number;
  groupBy: GroupBy;
  data: DrugCostSummaryPeriodRow[];
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

type PeriodRequestPayload = {
  d1?: string;
  d2?: string;
  groupBy?: string;
  opd?: string | boolean;
  ipd?: string | boolean;
  pttype?: string | string[];
  clinic?: string | string[];
  medtype?: string | string[];
  accnation?: string | string[];
};

function parsePipeList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join("|") : value;
  return raw
    .split("|")
    .map((v) => v.trim())
    .filter((v) => v !== "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const source: PeriodRequestPayload =
    req.method === "POST" ? ((req.body ?? {}) as PeriodRequestPayload) : ((req.query ?? {}) as PeriodRequestPayload);

  const { d1, d2, groupBy, opd, ipd, pttype, clinic, medtype, accnation } = source;

  if (!d1 || !d2 || typeof d1 !== "string" || typeof d2 !== "string") {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุช่วงวันที่ d1 และ d2 (รูปแบบ YYYY-MM-DD)",
    });
  }

  const includeOpd = opd == null ? true : String(opd) === "1" || String(opd).toLowerCase() === "true";
  const includeIpd = ipd == null ? false : String(ipd) === "1" || String(ipd).toLowerCase() === "true";

  if (!includeOpd && !includeIpd) {
    return res.status(400).json({
      success: false,
      message: "กรุณาเลือกอย่างน้อย 1 ประเภทบริการ (OPD หรือ IPD)",
    });
  }

  const whereVisitTypeSql =
    includeOpd && includeIpd
      ? ""
      : includeOpd
        ? "\n        AND ov.an IS NULL"
        : "\n        AND ov.an IS NOT NULL";

  const groupByValue: GroupBy = groupBy === "year" ? "year" : "month";
  const periodExpr =
    groupByValue === "year" ? "TO_CHAR(TRUNC(p.prscdate), 'YYYY')" : "TO_CHAR(TRUNC(p.prscdate), 'YYYY-MM')";
  const pttypeList = parsePipeList(pttype);
  const clinicList = parsePipeList(clinic);
  const medtypeList = parsePipeList(medtype);
  const accnationList = parsePipeList(accnation);

  const params: Record<string, unknown> = { d1, d2 };
  const whereParts: string[] = [];

  const bindList = (values: string[], prefix: string, columnSql: string) => {
    if (values.length === 0) return;
    const bindNames = values.map((value, idx) => {
      const name = `${prefix}${idx}`;
      params[name] = value;
      return `:${name}`;
    });
    whereParts.push(`${columnSql} IN (${bindNames.join(", ")})`);
  };

  bindList(pttypeList, "pttype", "pt.name");
  bindList(clinicList, "clinic", "lct.name");
  bindList(medtypeList, "medtype", "t.name");
  bindList(accnationList, "accnation", "a.name");
  const whereFiltersSql = whereParts.length > 0 ? `\n      AND ${whereParts.join("\n      AND ")}` : "";

  /*
   * ใช้สูตรเดียวกับ API รายละเอียด (/api/db/drug-cost-summary)
   * เพื่อให้ TOTAL_COST / TOTAL_SALE / TOTAL_PROFIT ตรงกัน
   * แต่สรุปผลเป็นรายเดือน/รายปีเพื่อลดขนาดผลลัพธ์
   */
  const sql = `
    WITH base AS (
      SELECT
        TRUNC(p.prscdate) AS PRSCDATE,
        m.meditem         AS MEDITEM,
        d.qty             AS QTY,
        COALESCE(
          NULLIF(
            (
              SELECT MAX(ms.costrate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
              FROM MEDITEMSALEHST ms
              WHERE ms.meditem = m.meditem
                AND ms.effectdate <= TRUNC(p.prscdate)
            ),
            0
          ),
          (
            SELECT MAX(ms.salerate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
            FROM MEDITEMSALEHST ms
            WHERE ms.meditem = m.meditem
              AND ms.effectdate <= TRUNC(p.prscdate)
          ),
          NULLIF(d.costrate, 0),
          d.salerate
        ) AS UNIT_COST,
        COALESCE(
          (
            SELECT MAX(ms.salerate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
            FROM MEDITEMSALEHST ms
            WHERE ms.meditem = m.meditem
              AND ms.effectdate <= TRUNC(p.prscdate)
          ),
          d.salerate,
          0
        ) AS UNIT_SALE
      FROM prsc p
      INNER JOIN prscdt d ON p.prscno = d.prscno
      INNER JOIN ovst ov ON ov.vn = p.vn
      INNER JOIN meditem m ON d.meditem = m.meditem
      INNER JOIN medtype t ON t.medtype = m.medtype
      INNER JOIN medaccnation a ON a.accnation = m.accnation
      LEFT JOIN lct ON d.sphmlct = lct.lct
      LEFT JOIN pttype pt ON pt.pttype = p.pttype
      WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
        ${whereVisitTypeSql}
        AND ov.canceldate IS NULL
      ${whereFiltersSql}
    )
    , period_agg AS (
      SELECT
        ${periodExpr} AS PERIOD_KEY,
        ${periodExpr} AS PERIOD_LABEL,
        COUNT(DISTINCT MEDITEM) AS TOTAL_ITEM_COUNT,
        SUM(QTY) AS TOTAL_QTY,
        SUM(QTY * UNIT_COST) AS TOTAL_COST,
        SUM(QTY * UNIT_SALE) AS TOTAL_SALE,
        SUM(QTY * (UNIT_SALE - UNIT_COST)) AS TOTAL_PROFIT
      FROM base p
      GROUP BY ${periodExpr}
    ),
    totals AS (
      SELECT COUNT(DISTINCT MEDITEM) AS TOTAL_UNIQUE_ITEM_COUNT
      FROM base
    )
    SELECT
      pa.PERIOD_KEY,
      pa.PERIOD_LABEL,
      pa.TOTAL_ITEM_COUNT,
      t.TOTAL_UNIQUE_ITEM_COUNT,
      pa.TOTAL_QTY,
      pa.TOTAL_COST,
      pa.TOTAL_SALE,
      pa.TOTAL_PROFIT
    FROM period_agg pa
    CROSS JOIN totals t
    ORDER BY pa.PERIOD_KEY
  `;

  try {
    const result = await executeQuery<DrugCostSummaryPeriodRow>(sql, params);
    const rows = result.rows ?? [];

    return res.status(200).json({
      success: true,
      count: rows.length,
      uniqueItemCount: Number(rows[0]?.TOTAL_UNIQUE_ITEM_COUNT ?? 0),
      groupBy: groupByValue,
      data: rows,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถดึงข้อมูลสรุปต้นทุนยาแบบรายช่วงเวลาได้",
      error: errorMessage,
    });
  }
}
