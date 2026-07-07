import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { parsePatientSearchFilters } from "@/lib/db/patientSearchFilters";

export type PatientXrayRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  XRAY_DATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  RDOEXM: string | null;
  EXAM_NAME: string | null;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientXrayRow[];
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

  const parsed = parsePatientSearchFilters(req, "TRUNC(r.rvstdate)");

  if (!parsed.ok) {
    return res.status(parsed.status).json({ success: false, message: parsed.message });
  }

  const { sql } = parsed;

  const querySql = `
    SELECT
      r.hn                                AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(r.rvstdate)                  AS XRAY_DATE,
      r.an                                AS AN,
      CASE WHEN r.an IS NOT NULL THEN 'IPD' ELSE 'OPD' END AS VISIT_TYPE,
      r.rdoexm                            AS RDOEXM,
      rd.name                             AS EXAM_NAME
    FROM rvstexm r
      INNER JOIN pt ON pt.hn = r.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN rdoexm rd ON rd.rdoexm = r.rdoexm
    WHERE r.rdoexm NOT IN ('00')
      ${sql.whereDate}
      ${sql.whereHn}
      ${sql.whereCardno}
      ${sql.whereName}
    ORDER BY
      r.rvstdate DESC,
      r.hn,
      rd.name,
      r.rdoexm
  `;

  try {
    const result = await executeQuery<PatientXrayRow>(querySql, sql.params);
    const rows = result.rows ?? [];

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหารายการ X-ray ได้", error);
  }
}
