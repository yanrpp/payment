import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { parsePatientSearchFilters } from "@/lib/db/patientSearchFilters";

export type PatientHistoryRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  VSTDATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  CC: string | null;
  HPI: string | null;
  PE: string | null;
  NOTE: string | null;
  CLINIC_NAME: string | null;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientHistoryRow[];
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

  const { sql } = parsed;

  const querySql = `
    SELECT
      ov.hn                               AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ov.vstdate)                   AS VSTDATE,
      ov.an                               AS AN,
      CASE WHEN ov.an IS NOT NULL THEN 'IPD' ELSE 'OPD' END AS VISIT_TYPE,
      os.cc                               AS CC,
      os.hpi                              AS HPI,
      os.pe                               AS PE,
      os.note                             AS NOTE,
      k.department                        AS CLINIC_NAME
    FROM ovst ov
      INNER JOIN pt ON pt.hn = ov.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN opdscreen os ON os.vn = ov.vn
      LEFT JOIN kskdepartment k ON k.depcode = ov.main_dep
    WHERE ov.canceldate IS NULL
      ${sql.whereDate}
      ${sql.whereHn}
      ${sql.whereCardno}
      ${sql.whereName}
    ORDER BY
      ov.vstdate DESC,
      ov.hn
  `;

  try {
    const result = await executeQuery<PatientHistoryRow>(querySql, sql.params);
    const rows = result.rows ?? [];

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหาการซักประวัติได้", error);
  }
}
