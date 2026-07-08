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
  ICD10_NAME_EN: string | null;
  DIAGTYPE: string | null;
  VISIT_REF: string | null;
  DIAG_AID: string | null;
  DOCTOR_NAME: string | null;
  CNOPDCARD_DIAG: string | null;
  CNOPDCARD_DIAG1: string | null;
  CNOPDCARD_DIAG2: string | null;
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

const ICD10_NAME_TH = "COALESCE(ic.thainame, ic.name)";
const ICD10_NAME_EN = "ic.name";

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

function buildPtdiagSql(
  whereDate: string,
  whereHn: string,
  whereCardno: string,
  whereName: string,
  withCnopdcard: boolean,
  withPhisuser: boolean
): string {
  const cnopdcardJoin = withCnopdcard
    ? "LEFT JOIN cnopdcard c ON c.hn = ptdiag.hn AND c.vn = ptdiag.vn"
    : "";
  const cnopdcardSelect = withCnopdcard
    ? `
      c.diag                              AS CNOPDCARD_DIAG,
      c.diag1                             AS CNOPDCARD_DIAG1,
      c.diag2                             AS CNOPDCARD_DIAG2`
    : `
      CAST(NULL AS VARCHAR2(4000))        AS CNOPDCARD_DIAG,
      CAST(NULL AS VARCHAR2(4000))      AS CNOPDCARD_DIAG1,
      CAST(NULL AS VARCHAR2(4000))      AS CNOPDCARD_DIAG2`;
  const phisuserJoin = withPhisuser ? "LEFT JOIN phisuser pu ON pu.staff = ptdiag.dct" : "";
  const doctorSelect = withPhisuser
    ? "NULLIF(TRIM(pu.dspname), '')"
    : "CAST(NULL AS VARCHAR2(250))";

  return `
    SELECT
      ptdiag.hn                           AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ptdiag.vstdate)               AS DIAG_DATE,
      ptdiag.an                           AS AN,
      CASE WHEN ptdiag.an IS NOT NULL THEN 'IPD' ELSE 'OPD' END AS VISIT_TYPE,
      ptdiag.icd10                        AS ICD10,
      ${ICD10_NAME_TH}                    AS ICD10_NAME,
      ${ICD10_NAME_EN}                    AS ICD10_NAME_EN,
      TO_CHAR(ptdiag.diagtype)            AS DIAGTYPE,
      COALESCE(TO_CHAR(ptdiag.vn), TO_CHAR(ptdiag.an)) AS VISIT_REF,
      NULLIF(TRIM(ptdiag.diagtxt), '')    AS DIAG_AID,
      ${doctorSelect}                     AS DOCTOR_NAME,${cnopdcardSelect}
    FROM ptdiag
      INNER JOIN pt ON pt.hn = ptdiag.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN icd10 ic ON ic.icd10 = ptdiag.icd10
      ${cnopdcardJoin}
      ${phisuserJoin}
    WHERE ptdiag.icd10 IS NOT NULL
      ${whereDate}
      ${whereHn}
      ${whereCardno}
      ${whereName}
  `;
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

  const { sql } = parsed;
  const wherePtdiagDate = sql.whereDate || buildWhereDateClause("TRUNC(ptdiag.vstdate)", parsed.bind);

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

    const fullSql = buildPtdiagSql(
      wherePtdiagDate,
      sql.whereHn,
      sql.whereCardno,
      sql.whereName,
      true,
      true
    );
    let batch = await tryOptionalDiagQuery(fullSql, sql.params);

    if (batch.length === 0) {
      batch = await tryOptionalDiagQuery(
        buildPtdiagSql(
          wherePtdiagDate,
          sql.whereHn,
          sql.whereCardno,
          sql.whereName,
          true,
          false
        ),
        sql.params
      );
    }

    if (batch.length === 0) {
      batch = await tryOptionalDiagQuery(
        buildPtdiagSql(
          wherePtdiagDate,
          sql.whereHn,
          sql.whereCardno,
          sql.whereName,
          false,
          false
        ),
        sql.params
      );
    }

    appendRows(batch);

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
