import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { sqlDrugDoseReadable, sqlDrugUsageFieldColumns, sqlDrugUsageJoins, sqlDrugUsageReadable, sqlPrscdtextJoin, sqlPrscdtextMedusageColumn } from "@/lib/db/drugUsageSql";
import { sqlUnitCost, sqlUnitSale } from "@/lib/db/meditemRateSql";

export type PatientMedicationRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  PRSCDATE: string;
  AN: string | null;
  VISIT_TYPE: string;
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
  PTTYPE_NAME: string | null;
  DRUG_USAGE: string | null;
  DRUG_DOSE: string | null;
  MEDUSETYPE_NAME: string | null;
  MEDUSEQTY_NAME: string | null;
  MEDUSETIME_NAME: string | null;
  MEDSYMPTOM_NAME: string | null;
  MEDUSEUNIT_NAME: string | null;
  MEDLBLHLP1: string | null;
  MEDLBLHLP_NAME: string | null;
  MEDLBLHLP2_NAME: string | null;
  MEDNOTE: string | null;
  PRSCDTEXT_MEDUSAGE: string | null;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientMedicationRow[];
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

const MAX_RANGE_DAYS = 366;

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

function daysBetweenInclusive(d1: Date, d2: Date): number {
  const ms = d2.getTime() - d1.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { d1, d2, hn, cardno, name } = req.query;

  const d1Value = typeof d1 === "string" && d1.trim() !== "" ? d1.trim() : null;
  const d2Value = typeof d2 === "string" && d2.trim() !== "" ? d2.trim() : null;

  if ((d1Value == null) !== (d2Value == null)) {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุช่วงวันที่ทั้งวันเริ่มและวันสิ้นสุด หรือไม่ระบุทั้งคู่",
    });
  }

  let whereDate = "";
  if (d1Value != null && d2Value != null) {
    const start = parseIsoDate(d1Value);
    const end = parseIsoDate(d2Value);
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "รูปแบบวันที่ไม่ถูกต้อง (ใช้ YYYY-MM-DD)",
      });
    }
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด",
      });
    }
    if (daysBetweenInclusive(start, end) > MAX_RANGE_DAYS) {
      return res.status(400).json({
        success: false,
        message: `ช่วงวันที่ต้องไม่เกิน ${MAX_RANGE_DAYS} วัน`,
      });
    }
    whereDate = `
        AND p.prscdate >= TO_DATE(:d1, 'YYYY-MM-DD')
        AND p.prscdate < TO_DATE(:d2, 'YYYY-MM-DD') + 1`;
  }

  const hnValue = typeof hn === "string" && hn.trim() !== "" ? hn.trim() : null;
  const cardnoValue =
    typeof cardno === "string" && cardno.trim() !== "" ? cardno.trim() : null;
  const nameValue = typeof name === "string" && name.trim() !== "" ? name.trim() : null;

  if (hnValue == null && cardnoValue == null && nameValue == null) {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุอย่างน้อย 1 เงื่อนไข: HN, เลขบัตรประชาชน หรือชื่อ-นามสกุล",
    });
  }

  const whereHn = hnValue != null ? " AND p.hn = :hn" : "";
  const whereCardno = cardnoValue != null ? " AND ptno.cardno = :cardno" : "";
  const whereName =
    nameValue != null
      ? ` AND (
          UPPER(pt.dspname) LIKE '%' || UPPER(TRIM(:name)) || '%'
          OR UPPER(TRIM(NVL(pt.fname, '') || ' ' || NVL(pt.lname, '')))
             LIKE '%' || UPPER(TRIM(:name)) || '%'
        )`
      : "";

  const unitCost = sqlUnitCost("m", "d", "p");
  const unitSale = sqlUnitSale("m", "d", "p");

  const sql = `
    WITH base AS (
      SELECT
        p.hn                                AS HN,
        ptno.cardno                         AS CARDNO,
        pt.dspname                          AS DSPNAME,
        TRUNC(p.prscdate)                   AS PRSCDATE,
        p.an                                AS AN,
        CASE WHEN p.an IS NOT NULL THEN 'IPD' ELSE 'OPD' END AS VISIT_TYPE,
        d.sphmlct                           AS CLINIC_LCT,
        lct.name                            AS CLINIC_LCT_NAME,
        m.meditem                           AS MEDITEM,
        t.name                              AS MEDTYPE,
        a.name                              AS ACCNATION,
        m.medname                           AS DRUG_NAME,
        d.qty                               AS QTY,
        pty.name                            AS PTTYPE_NAME,
        ${sqlDrugUsageReadable("d")}        AS DRUG_USAGE,
        ${sqlDrugDoseReadable("d")}       AS DRUG_DOSE,
        ${sqlDrugUsageFieldColumns("d")},
        ${sqlPrscdtextMedusageColumn()},
        ${unitCost}                         AS UNIT_COST,
        ${unitSale}                         AS UNIT_SALE
      FROM prsc p
        INNER JOIN prscdt d ON d.prscno = p.prscno
        INNER JOIN pt ON pt.hn = p.hn
        LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
        INNER JOIN meditem m ON m.meditem = d.meditem
        LEFT JOIN medtype t ON t.medtype = m.medtype
        LEFT JOIN medaccnation a ON a.accnation = m.accnation
        LEFT JOIN lct ON lct.lct = d.sphmlct
        LEFT JOIN pttype pty ON pty.pttype = p.pttype
        ${sqlDrugUsageJoins("d")}
        ${sqlPrscdtextJoin("d")}
      WHERE 1 = 1
        ${whereDate}
        ${whereHn}
        ${whereCardno}
        ${whereName}
    )
    SELECT
      HN,
      CARDNO,
      DSPNAME,
      PRSCDATE,
      AN,
      VISIT_TYPE,
      CLINIC_LCT,
      CLINIC_LCT_NAME,
      MEDITEM,
      MEDTYPE,
      ACCNATION,
      DRUG_NAME,
      SUM(QTY) AS TOTAL_QTY,
      SUM(QTY * UNIT_COST) AS TOTAL_COST,
      SUM(QTY * UNIT_SALE) AS TOTAL_SALE,
      SUM(QTY * (UNIT_SALE - UNIT_COST)) AS TOTAL_PROFIT,
      PTTYPE_NAME,
      DRUG_USAGE,
      DRUG_DOSE,
      MEDUSETYPE_NAME,
      MEDUSEQTY_NAME,
      MEDUSETIME_NAME,
      MEDSYMPTOM_NAME,
      MEDUSEUNIT_NAME,
      MEDLBLHLP1,
      MEDLBLHLP_NAME,
      MEDLBLHLP2_NAME,
      MEDNOTE,
      PRSCDTEXT_MEDUSAGE
    FROM base
    GROUP BY
      HN,
      CARDNO,
      DSPNAME,
      PRSCDATE,
      AN,
      VISIT_TYPE,
      CLINIC_LCT,
      CLINIC_LCT_NAME,
      MEDITEM,
      MEDTYPE,
      ACCNATION,
      DRUG_NAME,
      PTTYPE_NAME,
      DRUG_USAGE,
      DRUG_DOSE,
      MEDUSETYPE_NAME,
      MEDUSEQTY_NAME,
      MEDUSETIME_NAME,
      MEDSYMPTOM_NAME,
      MEDUSEUNIT_NAME,
      MEDLBLHLP1,
      MEDLBLHLP_NAME,
      MEDLBLHLP2_NAME,
      MEDNOTE,
      PRSCDTEXT_MEDUSAGE
    ORDER BY
      PRSCDATE DESC,
      HN,
      DRUG_NAME
  `;

  const params: Record<string, unknown> = {};
  if (d1Value != null && d2Value != null) {
    params.d1 = d1Value;
    params.d2 = d2Value;
  }
  if (hnValue != null) params.hn = hnValue;
  if (cardnoValue != null) params.cardno = cardnoValue;
  if (nameValue != null) params.name = nameValue;

  try {
    const result = await executeQuery<PatientMedicationRow>(sql, params);
    const rows = result.rows ?? [];

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหารายการยาได้", error);
  }
}
