import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { buildWhereDateClause, parsePatientSearchFilters } from "@/lib/db/patientSearchFilters";

export type PatientDiseaseRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  VSTDATE: string | null;
  DIAGDATE: string | null;
  ICD10: string | null;
  ICD10_NAME: string | null;
  DIAGTYPE: string | null;
  DOCTOR_NAME: string | null;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientDiseaseRow[];
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

  const parsed = parsePatientSearchFilters(req, "TRUNC(ptdiag.vstdate)");

  if (!parsed.ok) {
    return res.status(parsed.status).json({ success: false, message: parsed.message });
  }

  const { bind, sql } = parsed;
  const whereDiagDate = buildWhereDateClause("TRUNC(ptdiag.diagdate)", bind);
  const whereVisitDate = sql.whereDate || buildWhereDateClause("TRUNC(ptdiag.vstdate)", bind);

  const querySql = `
    SELECT
      ptdiag.hn                           AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ptdiag.vstdate)               AS VSTDATE,
      TRUNC(ptdiag.diagdate)              AS DIAGDATE,
      ptdiag.icd10                        AS ICD10,
      COALESCE(ic.thainame, ic.name)      AS ICD10_NAME,
      ptdiag.diagtype                     AS DIAGTYPE,
      dct.dspname                         AS DOCTOR_NAME
    FROM ptdiag
      INNER JOIN pt ON pt.hn = ptdiag.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN icd10 ic ON ic.icd10 = ptdiag.icd10
      LEFT JOIN dct ON dct.dct = ptdiag.dct
    WHERE 1 = 1
      ${whereVisitDate || whereDiagDate}
      ${sql.whereHn}
      ${sql.whereCardno}
      ${sql.whereName}
    ORDER BY
      ptdiag.diagdate DESC NULLS LAST,
      ptdiag.vstdate DESC NULLS LAST,
      ptdiag.icd10
  `;

  try {
    const result = await executeQuery<PatientDiseaseRow>(querySql, sql.params);
    const rows = result.rows ?? [];

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหารายการโรคได้", error);
  }
}
