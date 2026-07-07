import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { parsePatientSearchFilters } from "@/lib/db/patientSearchFilters";

export type PatientHistoryRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  VSTDATE: string;
  VSTTIME: string | null;
  VN: string | null;
  AN: string | null;
  VISIT_TYPE: string;
  OQUEUE: number | null;
  CLINIC_NAME: string | null;
  DOCTOR_NAME: string | null;
  BW: number | null;
  HEIGHT: number | null;
  BMI: number | null;
  PULSE: number | null;
  RR: number | null;
  TEMPERATURE: number | null;
  BPS: number | null;
  BPD: number | null;
  FBS: number | null;
  O2SAT: number | null;
  CC: string | null;
  HPI: string | null;
  PE: string | null;
  NOTE: string | null;
  DIAG_TEXT: string | null;
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

const LOB = (expr: string) => `DBMS_LOB.SUBSTR(${expr}, 4000, 1)`;

const OPDSCREEN_HPI = `TRIM(
  COALESCE(os.his_frequency, '') || ' ' ||
  COALESCE(os.his_severity, '') || ' ' ||
  COALESCE(os.his_cause, '') || ' ' ||
  COALESCE(os.his_expand, '') || ' ' ||
  COALESCE(os.his_related_sign, '')
)`;

const OPDSCREEN_BMI = `CASE
  WHEN os.height IS NOT NULL AND os.height > 0 AND os.bw IS NOT NULL AND os.bw > 0
  THEN ROUND(os.bw / POWER(os.height / 100, 2), 1)
  ELSE NULL
END`;

const BASE_SELECT = `
      ov.hn                               AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ov.vstdate)                   AS VSTDATE,
      CAST(ov.vsttime AS VARCHAR2(8))     AS VSTTIME,
      ov.vn                               AS VN,
      ov.an                               AS AN,
      CASE WHEN ov.an IS NOT NULL THEN 'IPD' ELSE 'OPD' END AS VISIT_TYPE,
      ov.oqueue                           AS OQUEUE`;

const BASE_FROM = `
      INNER JOIN pt ON pt.hn = ov.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10`;

const BASE_SELECT_MINIMAL = `
      ov.hn                               AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(ov.vstdate)                   AS VSTDATE,
      CAST(NULL AS VARCHAR2(8))           AS VSTTIME,
      ov.vn                               AS VN,
      ov.an                               AS AN,
      CASE WHEN ov.an IS NOT NULL THEN 'IPD' ELSE 'OPD' END AS VISIT_TYPE,
      CAST(NULL AS NUMBER)                AS OQUEUE`;

function buildHistorySql(
  detailSelect: string,
  extraJoins: string,
  baseSelect: string = BASE_SELECT
): string {
  return `
    SELECT
${baseSelect},
${detailSelect}
    FROM ovst ov
${BASE_FROM}
${extraJoins}
    WHERE ov.canceldate IS NULL
  `;
}

/** ลำดับ fallback ตาม schema ที่พบใน RPP */
function buildQueryVariants(): string[] {
  const opdscreenDetail = `
      TO_CHAR(ov.main_dep)                AS CLINIC_NAME,
      TO_CHAR(ov.doctor)                  AS DOCTOR_NAME,
      os.bw                               AS BW,
      os.height                           AS HEIGHT,
      ${OPDSCREEN_BMI}                    AS BMI,
      os.pulse                            AS PULSE,
      os.rr                               AS RR,
      os.temperature                      AS TEMPERATURE,
      os.bps                              AS BPS,
      os.bpd                              AS BPD,
      os.fbs                              AS FBS,
      NULL                                AS O2SAT,
      ${LOB("os.cc")}                     AS CC,
      ${OPDSCREEN_HPI}                    AS HPI,
      ${LOB("os.pe")}                     AS PE,
      ${LOB("os.note")}                   AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`;

  const ovstOnlyDetail = `
      CAST(NULL AS VARCHAR2(250))         AS CLINIC_NAME,
      CAST(NULL AS VARCHAR2(150))         AS DOCTOR_NAME,
      NULL                                AS BW,
      NULL                                AS HEIGHT,
      NULL                                AS BMI,
      NULL                                AS PULSE,
      NULL                                AS RR,
      NULL                                AS TEMPERATURE,
      NULL                                AS BPS,
      NULL                                AS BPD,
      NULL                                AS FBS,
      NULL                                AS O2SAT,
      NULL                                AS CC,
      NULL                                AS HPI,
      NULL                                AS PE,
      NULL                                AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`;

  return [
    buildHistorySql(
      `
      COALESCE(k.department, TO_CHAR(ov.main_dep)) AS CLINIC_NAME,
      doc.name                            AS DOCTOR_NAME,
      os.bw                               AS BW,
      os.height                           AS HEIGHT,
      ${OPDSCREEN_BMI}                    AS BMI,
      os.pulse                            AS PULSE,
      os.rr                               AS RR,
      os.temperature                      AS TEMPERATURE,
      os.bps                              AS BPS,
      os.bpd                              AS BPD,
      os.fbs                              AS FBS,
      NULL                                AS O2SAT,
      ${LOB("os.cc")}                     AS CC,
      ${OPDSCREEN_HPI}                    AS HPI,
      ${LOB("os.pe")}                     AS PE,
      ${LOB("os.note")}                   AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`,
      `
      LEFT JOIN opdscreen os ON os.vn = ov.vn
      LEFT JOIN doctor doc ON doc.code = ov.doctor
      LEFT JOIN kskdepartment k ON k.depcode = ov.main_dep`
    ),
    buildHistorySql(
      `
      TO_CHAR(ov.main_dep)                AS CLINIC_NAME,
      doc.name                            AS DOCTOR_NAME,
      os.bw                               AS BW,
      os.height                           AS HEIGHT,
      ${OPDSCREEN_BMI}                    AS BMI,
      os.pulse                            AS PULSE,
      os.rr                               AS RR,
      os.temperature                      AS TEMPERATURE,
      os.bps                              AS BPS,
      os.bpd                              AS BPD,
      os.fbs                              AS FBS,
      NULL                                AS O2SAT,
      ${LOB("os.cc")}                     AS CC,
      ${OPDSCREEN_HPI}                    AS HPI,
      ${LOB("os.pe")}                     AS PE,
      ${LOB("os.note")}                   AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`,
      `
      LEFT JOIN opdscreen os ON os.vn = ov.vn
      LEFT JOIN doctor doc ON doc.code = ov.doctor`
    ),
    buildHistorySql(
      opdscreenDetail,
      `
      LEFT JOIN opdscreen os ON os.vn = ov.vn`
    ),
    buildHistorySql(
      `
      TO_CHAR(ov.main_dep)                AS CLINIC_NAME,
      TO_CHAR(ov.doctor)                  AS DOCTOR_NAME,
      os.bw                               AS BW,
      NULL                                AS HEIGHT,
      NULL                                AS BMI,
      os.p                                AS PULSE,
      os.rr                               AS RR,
      os.t                                AS TEMPERATURE,
      os.bps                              AS BPS,
      os.bpd                              AS BPD,
      NULL                                AS FBS,
      NULL                                AS O2SAT,
      os.cc                               AS CC,
      NULL                                AS HPI,
      NULL                                AS PE,
      os.note                             AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`,
      `
      LEFT JOIN opdscreening os ON os.vn = ov.vn`
    ),
    buildHistorySql(ovstOnlyDetail, "", BASE_SELECT_MINIMAL),
  ];
}

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
  const tail = `
      ${sql.whereDate}
      ${sql.whereHn}
      ${sql.whereCardno}
      ${sql.whereName}
    ORDER BY
      ov.vstdate DESC,
      ov.hn,
      ov.vn
  `;

  try {
    let rows: PatientHistoryRow[] | undefined;
    let lastError: unknown;

    for (const baseSql of buildQueryVariants()) {
      try {
        const result = await executeQuery<PatientHistoryRow>(baseSql + tail, sql.params);
        rows = result.rows ?? [];
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!rows) {
      throw lastError ?? new Error("ไม่สามารถดึงข้อมูลการซักประวัติได้");
    }

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหาการซักประวัติได้", error);
  }
}
