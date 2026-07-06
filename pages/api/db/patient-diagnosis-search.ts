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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const parsed = parsePatientSearchFilters(req, "TRUNC(ov.vstdate)");
  if (!parsed.ok) {
    return res.status(parsed.status).json({ success: false, message: parsed.message });
  }

  const { bind, sql } = parsed;
  const whereOpdDate = buildWhereDateClause("TRUNC(ov.vstdate)", bind);
  const whereIpdDate = buildWhereDateClause("TRUNC(ipt.rgtdate)", bind);

  const opdSql = `
    SELECT
      ov.hn                               AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ov.vstdate)                   AS DIAG_DATE,
      ov.an                               AS AN,
      'OPD'                               AS VISIT_TYPE,
      od.icd10                            AS ICD10,
      ic.name                             AS ICD10_NAME,
      od.diagtype                         AS DIAGTYPE,
      od.vn                               AS VISIT_REF
    FROM ovstdiag od
      INNER JOIN ovst ov ON ov.vn = od.vn
      INNER JOIN pt ON pt.hn = ov.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN icd101 ic ON ic.icd101 = od.icd10
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
      ic.name                             AS ICD10_NAME,
      id.diagtype                         AS DIAGTYPE,
      id.an                               AS VISIT_REF
    FROM iptdiag id
      INNER JOIN ipt ON ipt.an = id.an
      INNER JOIN pt ON pt.hn = ipt.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN icd101 ic ON ic.icd101 = id.icd10
    WHERE 1 = 1
      ${whereIpdDate}
      ${sql.whereHn}
      ${sql.whereCardno}
      ${sql.whereName}
  `;

  try {
    const rows: PatientDiagnosisRow[] = [];

    try {
      const opdResult = await executeQuery<PatientDiagnosisRow>(opdSql, sql.params);
      rows.push(...(opdResult.rows ?? []));
    } catch {
      // ovstdiag อาจไม่มีใน schema
    }

    try {
      const ipdResult = await executeQuery<PatientDiagnosisRow>(ipdSql, sql.params);
      rows.push(...(ipdResult.rows ?? []));
    } catch {
      // iptdiag อาจไม่มีใน schema
    }

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
