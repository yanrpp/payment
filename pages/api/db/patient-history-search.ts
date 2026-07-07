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

const OVST_BMI = `CASE
  WHEN ov.height IS NOT NULL AND ov.height > 0 AND ov.weight IS NOT NULL AND ov.weight > 0
  THEN ROUND(ov.weight / POWER(ov.height / 100, 2), 1)
  ELSE NULL
END`;

const OVST_BMI_WITH_OPD = `CASE
  WHEN COALESCE(ov.height, os.height) IS NOT NULL AND COALESCE(ov.height, os.height) > 0
   AND COALESCE(ov.weight, os.bw) IS NOT NULL AND COALESCE(ov.weight, os.bw) > 0
  THEN ROUND(
    COALESCE(ov.weight, os.bw) / POWER(COALESCE(ov.height, os.height) / 100, 2),
    1
  )
  ELSE NULL
END`;

const VITALS_OVST = `
      ov.weight                           AS BW,
      ov.height                           AS HEIGHT,
      ${OVST_BMI}                         AS BMI,
      ov.pr                               AS PULSE,
      ov.rr                               AS RR`;

const VITALS_WITH_OPDSCREEN = `
      COALESCE(ov.weight, os.bw)          AS BW,
      COALESCE(ov.height, os.height)      AS HEIGHT,
      ${OVST_BMI_WITH_OPD}                AS BMI,
      COALESCE(ov.pr, os.pulse)           AS PULSE,
      COALESCE(ov.rr, os.rr)              AS RR`;

const VITALS_WITH_OPDSCREENING = `
      COALESCE(ov.weight, os.bw)          AS BW,
      ov.height                           AS HEIGHT,
      ${OVST_BMI}                         AS BMI,
      COALESCE(ov.pr, os.p)               AS PULSE,
      COALESCE(ov.rr, os.rr)              AS RR`;

/** อาการสำคัญ — RPP เก็บใน ovst.ccp, บาง site มีเพิ่มใน opdscreen.cc */
const OVST_CC_LOB = LOB("ov.ccp");
const OVST_CC_VARCHAR = "TRIM(ov.ccp)";
const CC_WITH_OPDSCREEN = `TRIM(COALESCE(NULLIF(${OVST_CC_VARCHAR}, ''), NULLIF(${LOB("os.cc")}, '')))`;
const CC_WITH_OPDSCREENING = `TRIM(COALESCE(NULLIF(${OVST_CC_VARCHAR}, ''), NULLIF(os.cc, '')))`;

/** ความดันโลหิตจาก ovstpress (RPP) — join ครั้งเดียว เร็วกว่า scalar subquery ต่อแถว */
const JOIN_OVSTPRESS = `LEFT JOIN ovstpress vp ON vp.vn = ov.vn`;

const BP_FROM_OVSTPRESS = `
      vp.hbpn                                AS BPS,
      vp.lbpn                                AS BPD`;

const BP_NULL = `
      CAST(NULL AS NUMBER)                   AS BPS,
      CAST(NULL AS NUMBER)                   AS BPD`;

const BP_WITH_OPDSCREEN = `
      COALESCE(os.bps, vp.hbpn)              AS BPS,
      COALESCE(os.bpd, vp.lbpn)              AS BPD`;

const BP_WITH_OPDSCREENING = `
      COALESCE(os.bps, vp.hbpn)              AS BPS,
      COALESCE(os.bpd, vp.lbpn)              AS BPD`;

const BASE_SELECT = `
      ov.hn                               AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TO_CHAR(TRUNC(ov.vstdate), 'YYYY-MM-DD') AS VSTDATE,
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
      TO_CHAR(TRUNC(ov.vstdate), 'YYYY-MM-DD') AS VSTDATE,
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
${VITALS_WITH_OPDSCREEN},
      os.temperature                      AS TEMPERATURE,
${BP_WITH_OPDSCREEN},
      os.fbs                              AS FBS,
      NULL                                AS O2SAT,
      ${CC_WITH_OPDSCREEN}                AS CC,
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

  const ovstCcpDetail = (ccExpr: string, bpSelect: string) => `
      CAST(NULL AS VARCHAR2(250))         AS CLINIC_NAME,
      CAST(NULL AS VARCHAR2(150))         AS DOCTOR_NAME,
${VITALS_OVST},
      NULL                                AS TEMPERATURE,
${bpSelect},
      NULL                                AS FBS,
      NULL                                AS O2SAT,
      ${ccExpr}                           AS CC,
      NULL                                AS HPI,
      NULL                                AS PE,
      NULL                                AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`;

  return [
    buildHistorySql(
      ovstCcpDetail(OVST_CC_VARCHAR, BP_FROM_OVSTPRESS),
      JOIN_OVSTPRESS,
      BASE_SELECT_MINIMAL
    ),
    buildHistorySql(ovstCcpDetail(OVST_CC_VARCHAR, BP_NULL), "", BASE_SELECT_MINIMAL),
    buildHistorySql(
      ovstCcpDetail(OVST_CC_LOB, BP_FROM_OVSTPRESS),
      JOIN_OVSTPRESS,
      BASE_SELECT_MINIMAL
    ),
    buildHistorySql(ovstCcpDetail(OVST_CC_LOB, BP_NULL), "", BASE_SELECT_MINIMAL),
    buildHistorySql(
      `
      COALESCE(k.department, TO_CHAR(ov.main_dep)) AS CLINIC_NAME,
      doc.name                            AS DOCTOR_NAME,
${VITALS_WITH_OPDSCREEN},
      os.temperature                      AS TEMPERATURE,
${BP_WITH_OPDSCREEN},
      os.fbs                              AS FBS,
      NULL                                AS O2SAT,
      ${CC_WITH_OPDSCREEN}                AS CC,
      ${OPDSCREEN_HPI}                    AS HPI,
      ${LOB("os.pe")}                     AS PE,
      ${LOB("os.note")}                   AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`,
      `
      LEFT JOIN opdscreen os ON os.vn = ov.vn
      LEFT JOIN doctor doc ON doc.code = ov.doctor
      LEFT JOIN kskdepartment k ON k.depcode = ov.main_dep
${JOIN_OVSTPRESS}`
    ),
    buildHistorySql(
      `
      TO_CHAR(ov.main_dep)                AS CLINIC_NAME,
      doc.name                            AS DOCTOR_NAME,
${VITALS_WITH_OPDSCREEN},
      os.temperature                      AS TEMPERATURE,
${BP_WITH_OPDSCREEN},
      os.fbs                              AS FBS,
      NULL                                AS O2SAT,
      ${CC_WITH_OPDSCREEN}                AS CC,
      ${OPDSCREEN_HPI}                    AS HPI,
      ${LOB("os.pe")}                     AS PE,
      ${LOB("os.note")}                   AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`,
      `
      LEFT JOIN opdscreen os ON os.vn = ov.vn
      LEFT JOIN doctor doc ON doc.code = ov.doctor
${JOIN_OVSTPRESS}`
    ),
    buildHistorySql(
      opdscreenDetail,
      `
      LEFT JOIN opdscreen os ON os.vn = ov.vn
${JOIN_OVSTPRESS}`
    ),
    buildHistorySql(
      `
      TO_CHAR(ov.main_dep)                AS CLINIC_NAME,
      TO_CHAR(ov.doctor)                  AS DOCTOR_NAME,
${VITALS_WITH_OPDSCREENING},
      os.t                                AS TEMPERATURE,
${BP_WITH_OPDSCREENING},
      NULL                                AS FBS,
      NULL                                AS O2SAT,
      ${CC_WITH_OPDSCREENING}             AS CC,
      NULL                                AS HPI,
      NULL                                AS PE,
      os.note                             AS NOTE,
      CAST(NULL AS VARCHAR2(4000))        AS DIAG_TEXT`,
      `
      LEFT JOIN opdscreening os ON os.vn = ov.vn
${JOIN_OVSTPRESS}`
    ),
    buildHistorySql(ovstOnlyDetail, "", BASE_SELECT_MINIMAL),
  ];
}

function dedupeHistoryRows(rows: PatientHistoryRow[]): PatientHistoryRow[] {
  const seen = new Set<string>();
  const out: PatientHistoryRow[] = [];

  for (const row of rows) {
    const key = `${row.HN}|${row.VN ?? ""}|${row.VSTDATE}`;

    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
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
        const result = await executeQuery<PatientHistoryRow>(baseSql + tail, sql.params, {
          logErrors: false,
        });

        rows = result.rows ?? [];
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!rows) {
      if (lastError) {
        // eslint-disable-next-line no-console
        console.error("Query execution failed:", lastError);
      }
      throw lastError ?? new Error("ไม่สามารถดึงข้อมูลการซักประวัติได้");
    }

    const deduped = dedupeHistoryRows(rows);

    return res.status(200).json({
      success: true,
      count: deduped.length,
      data: deduped,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหาการซักประวัติได้", error);
  }
}
