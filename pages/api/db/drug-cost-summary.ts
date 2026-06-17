import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { buildDrugSourceSql } from "@/lib/db/drugSourceSql";
import { sqlUnitCost, sqlUnitSale } from "@/lib/db/meditemRateSql";

type DrugCostSummaryRow = {
  HN: string;
  AN: string | null;
  WARD_NAME: string | null;
  VISIT_KEY: string;
  /** ชื่อสิทธิจาก pttype.name (ผูกจาก prsc.pttype) */
  PTTYPE_NAME: string | null;
  CLINIC_LCT: string | null;
  CLINIC_LCT_NAME: string | null;
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
  uniqueVisitCount: number;
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

  const { d1, d2, opd, ipd } = req.query;

  if (!d1 || !d2 || typeof d1 !== "string" || typeof d2 !== "string") {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุช่วงวันที่ d1 และ d2 (รูปแบบ YYYY-MM-DD)",
    });
  }

  const includeOpd =
    opd == null ? true : String(opd) === "1" || String(opd).toLowerCase() === "true";
  const includeIpd =
    ipd == null ? false : String(ipd) === "1" || String(ipd).toLowerCase() === "true";

  if (!includeOpd && !includeIpd) {
    return res.status(400).json({
      success: false,
      message: "กรุณาเลือกอย่างน้อย 1 ประเภทบริการ (OPD หรือ IPD)",
    });
  }

  const src = buildDrugSourceSql(includeOpd, includeIpd);
  const unitCost = sqlUnitCost("m", "d", "p");
  const unitSale = sqlUnitSale("m", "d", "p");

  const sql = `
    WITH base AS (
      SELECT
        p.hn                                AS HN,
        ${src.anExpr}                       AS AN,
        ${src.visitKeyExpr}                 AS VISIT_KEY,
        d.sphmlct                           AS CLINIC_LCT,
        lct.name                            AS CLINIC_LCT_NAME,
        m.meditem                           AS MEDITEM,
        t.name                              AS MEDTYPE,
        a.name                              AS ACCNATION,
        m.medname                           AS DRUG_NAME,
        d.qty                               AS QTY,
        CAST(NULL AS VARCHAR2(255))         AS WARD_NAME,
        ${unitCost}                         AS UNIT_COST,
        ${unitSale}                         AS UNIT_SALE,
        pt.name                             AS PTTYPE_NAME
      ${src.fromJoinSql}
      WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')${src.whereAnchorSql}
    )
    SELECT
      HN,
      AN,
      WARD_NAME,
      VISIT_KEY,
      PTTYPE_NAME,
      CLINIC_LCT,
      CLINIC_LCT_NAME,
      MEDITEM,
      MEDTYPE,
      ACCNATION,
      DRUG_NAME,
      SUM(QTY) AS TOTAL_QTY,
      SUM(QTY * UNIT_COST) AS TOTAL_COST,
      SUM(QTY * UNIT_SALE) AS TOTAL_SALE,
      SUM(QTY * (UNIT_SALE - UNIT_COST)) AS TOTAL_PROFIT
    FROM base
    GROUP BY
      HN,
      AN,
      WARD_NAME,
      VISIT_KEY,
      PTTYPE_NAME,
      CLINIC_LCT,
      CLINIC_LCT_NAME,
      MEDITEM,
      MEDTYPE,
      ACCNATION,
      DRUG_NAME
    ORDER BY
      MEDITEM,
      DRUG_NAME
  `;

  const sqlUniqueVisitCount = `
    SELECT COUNT(DISTINCT ${src.visitCountExpr}) AS UNIQUE_VISIT_COUNT
    ${src.fromJoinSql}
    WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')${src.whereAnchorSql}
  `;

  try {
    const [result, visitCountResult] = await Promise.all([
      executeQuery<DrugCostSummaryRow>(sql, { d1, d2 }),
      executeQuery<{ UNIQUE_VISIT_COUNT: number }>(sqlUniqueVisitCount, { d1, d2 }),
    ]);
    const rows = result.rows ?? [];
    const uniqueVisitCount = Number(visitCountResult.rows?.[0]?.UNIQUE_VISIT_COUNT ?? 0);

    return res.status(200).json({
      success: true,
      count: rows.length,
      uniqueVisitCount,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงข้อมูลสรุปต้นทุนยาได้", error);
  }
}
