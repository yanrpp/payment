import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { buildWhereDateClause, parsePatientSearchFilters } from "@/lib/db/patientSearchFilters";

export type PatientDiagnosisRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  DIAG_DATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  ICD10: string | null;
  ICD10_NAME: string | null;
  DIAGTYPE: string | null;
  VISIT_REF: string | null;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientDiagnosisRow[];
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

/** ชื่อ ICD-10 จาก icd10 (schema RPP) */
const ICD10_NAME_EXPR = "COALESCE(ic.thainame, ic.name)";

/** ตาราง/คอลัมน์ไม่มีใน schema บางโรงพยาบาล — ใช้ fallback แทน ไม่ต้อง log error */
function isOptionalSchemaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("errorNum" in error)) return false;
  const code = Number((error as { errorNum: number }).errorNum);

  return code === 942 || code === 904;
}

async function tryOptionalDiagQuery(
  sql: string,
  params: Record<string, unknown>
): Promise<PatientDiagnosisRow[]> {
  try {
    const result = await executeQuery<PatientDiagnosisRow>(sql, params, { logErrors: false });

    return result.rows ?? [];
  } catch (error) {
    if (isOptionalSchemaError(error)) return [];
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const parsed = parsePatientSearchFilters(req, "TRUNC(ptdiag.vstdate)");

  if (!parsed.ok) {
    return res.status(parsed.status).json({ success: false, message: parsed.message });
  }

  const { bind, sql } = parsed;
  const wherePtdiagDate = sql.whereDate || buildWhereDateClause("TRUNC(ptdiag.vstdate)", bind);
  const whereOpdDate = buildWhereDateClause("TRUNC(ov.vstdate)", bind);
  const whereIpdDate = buildWhereDateClause("TRUNC(ipt.rgtdate)", bind);

  /** รหัสวินิจฉัยหลักของ RPP — อยู่ใน ptdiag (hn + vstdate + icd10) */
  const ptdiagSql = `
    SELECT
      ptdiag.hn                           AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ptdiag.vstdate)               AS DIAG_DATE,
      ptdiag.an                           AS AN,
      CASE WHEN ptdiag.an IS NOT NULL THEN 'IPD' ELSE 'OPD' END AS VISIT_TYPE,
      ptdiag.icd10                        AS ICD10,
      ${ICD10_NAME_EXPR}                  AS ICD10_NAME,
      TO_CHAR(ptdiag.diagtype)            AS DIAGTYPE,
      COALESCE(TO_CHAR(ptdiag.vn), TO_CHAR(ptdiag.an)) AS VISIT_REF
    FROM ptdiag
      INNER JOIN pt ON pt.hn = ptdiag.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN icd10 ic ON ic.icd10 = ptdiag.icd10
    WHERE ptdiag.icd10 IS NOT NULL
      ${wherePtdiagDate}
      ${sql.whereHn}
      ${sql.whereCardno}
      ${sql.whereName}
  `;

  const opdSql = `
    SELECT
      ov.hn                               AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ov.vstdate)                   AS DIAG_DATE,
      ov.an                               AS AN,
      'OPD'                               AS VISIT_TYPE,
      od.icd10                            AS ICD10,
      ${ICD10_NAME_EXPR}                  AS ICD10_NAME,
      od.diagtype                         AS DIAGTYPE,
      od.vn                               AS VISIT_REF
    FROM ovstdiag od
      INNER JOIN ovst ov ON ov.vn = od.vn
      INNER JOIN pt ON pt.hn = ov.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN icd10 ic ON ic.icd10 = od.icd10
    WHERE ov.canceldate IS NULL
      AND ov.an IS NULL
      ${whereOpdDate}
      ${sql.whereHn}
      ${sql.whereCardno}
      ${sql.whereName}
  `;

  const ipdSql = `
    SELECT
      ipt.hn                              AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ipt.rgtdate)                  AS DIAG_DATE,
      ipt.an                              AS AN,
      'IPD'                               AS VISIT_TYPE,
      id.icd10                            AS ICD10,
      ${ICD10_NAME_EXPR}                  AS ICD10_NAME,
      id.diagtype                         AS DIAGTYPE,
      id.an                               AS VISIT_REF
    FROM iptdiag id
      INNER JOIN ipt ON ipt.an = id.an
      INNER JOIN pt ON pt.hn = ipt.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN icd10 ic ON ic.icd10 = id.icd10
    WHERE 1 = 1
      ${whereIpdDate}
      ${sql.whereHn}
      ${sql.whereCardno}
      ${sql.whereName}
  `;

  try {
    const rows: PatientDiagnosisRow[] = [];
    const seen = new Set<string>();

    const appendRows = (batch: PatientDiagnosisRow[] | undefined) => {
      for (const row of batch ?? []) {
        const key = `${row.HN}|${String(row.DIAG_DATE).slice(0, 10)}|${row.ICD10 ?? ""}|${row.DIAGTYPE ?? ""}|${row.VISIT_REF ?? ""}`;

        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
      }
    };

    appendRows(await tryOptionalDiagQuery(ptdiagSql, sql.params));
    appendRows(await tryOptionalDiagQuery(opdSql, sql.params));
    appendRows(await tryOptionalDiagQuery(ipdSql, sql.params));

    rows.sort((a, b) => {
      const dateCmp = String(b.DIAG_DATE).localeCompare(String(a.DIAG_DATE));

      if (dateCmp !== 0) return dateCmp;

      return String(a.ICD10 ?? "").localeCompare(String(b.ICD10 ?? ""));
    });

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหารหัสวินิจฉัยได้", error);
  }
}
