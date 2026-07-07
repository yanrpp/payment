import type { NextApiRequest } from "next";

export const MAX_PATIENT_SEARCH_RANGE_DAYS = 366;

export type PatientSearchBind = {
  hn: string | null;
  cardno: string | null;
  name: string | null;
  d1: string | null;
  d2: string | null;
};

export type PatientSearchSql = {
  params: Record<string, unknown>;
  whereDate: string;
  whereHn: string;
  whereCardno: string;
  whereName: string;
};

type ParseOk = { ok: true; bind: PatientSearchBind; sql: PatientSearchSql };
type ParseErr = { ok: false; status: number; message: string };

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

/** แปลง query string เป็น bind + SQL fragments สำหรับค้นหาผู้ป่วย */
export function parsePatientSearchFilters(
  req: NextApiRequest,
  dateColumnSql: string
): ParseOk | ParseErr {
  const { d1, d2, hn, cardno, name } = req.query;

  const d1Value = typeof d1 === "string" && d1.trim() !== "" ? d1.trim() : null;
  const d2Value = typeof d2 === "string" && d2.trim() !== "" ? d2.trim() : null;

  if ((d1Value == null) !== (d2Value == null)) {
    return {
      ok: false,
      status: 400,
      message: "กรุณาระบุช่วงวันที่ทั้งวันเริ่มและวันสิ้นสุด หรือไม่ระบุทั้งคู่",
    };
  }

  let whereDate = "";

  if (d1Value != null && d2Value != null) {
    const start = parseIsoDate(d1Value);
    const end = parseIsoDate(d2Value);

    if (!start || !end) {
      return { ok: false, status: 400, message: "รูปแบบวันที่ไม่ถูกต้อง (ใช้ YYYY-MM-DD)" };
    }
    if (start > end) {
      return { ok: false, status: 400, message: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" };
    }
    if (daysBetweenInclusive(start, end) > MAX_PATIENT_SEARCH_RANGE_DAYS) {
      return {
        ok: false,
        status: 400,
        message: `ช่วงวันที่ต้องไม่เกิน ${MAX_PATIENT_SEARCH_RANGE_DAYS} วัน`,
      };
    }
    whereDate = `
        AND ${dateColumnSql} >= TO_DATE(:d1, 'YYYY-MM-DD')
        AND ${dateColumnSql} < TO_DATE(:d2, 'YYYY-MM-DD') + 1`;
  }

  const hnValue = typeof hn === "string" && hn.trim() !== "" ? hn.trim() : null;
  const cardnoValue = typeof cardno === "string" && cardno.trim() !== "" ? cardno.trim() : null;
  const nameValue = typeof name === "string" && name.trim() !== "" ? name.trim() : null;

  if (hnValue == null && cardnoValue == null && nameValue == null) {
    return {
      ok: false,
      status: 400,
      message: "กรุณาระบุอย่างน้อย 1 เงื่อนไข: HN, เลขบัตรประชาชน หรือชื่อ-นามสกุล",
    };
  }

  const whereHn = hnValue != null ? " AND pt.hn = :hn" : "";
  const whereCardno = cardnoValue != null ? " AND ptno.cardno = :cardno" : "";
  const whereName =
    nameValue != null
      ? ` AND (
          UPPER(pt.dspname) LIKE '%' || UPPER(TRIM(:name)) || '%'
          OR UPPER(TRIM(NVL(pt.fname, '') || ' ' || NVL(pt.lname, '')))
             LIKE '%' || UPPER(TRIM(:name)) || '%'
        )`
      : "";

  const params: Record<string, unknown> = {};

  if (d1Value != null && d2Value != null) {
    params.d1 = d1Value;
    params.d2 = d2Value;
  }
  if (hnValue != null) params.hn = hnValue;
  if (cardnoValue != null) params.cardno = cardnoValue;
  if (nameValue != null) params.name = nameValue;

  return {
    ok: true,
    bind: { hn: hnValue, cardno: cardnoValue, name: nameValue, d1: d1Value, d2: d2Value },
    sql: { params, whereDate, whereHn, whereCardno, whereName },
  };
}

/** สร้างเงื่อนไขช่วงวันที่สำหรับคอลัมน์ที่กำหนด (ใช้ bind :d1/:d2 เดิม) */
export function buildWhereDateClause(dateColumnSql: string, bind: PatientSearchBind): string {
  if (bind.d1 == null || bind.d2 == null) return "";

  return `
        AND ${dateColumnSql} >= TO_DATE(:d1, 'YYYY-MM-DD')
        AND ${dateColumnSql} < TO_DATE(:d2, 'YYYY-MM-DD') + 1`;
}
