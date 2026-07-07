import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

export type PatientLabRow = {
  HN: string;
  CARDNO: string | null;
  DSPNAME: string | null;
  LAB_DATE: string;
  AN: string | null;
  VISIT_TYPE: string;
  LABEXM: number | null;
  LAB_NAME: string | null;
  RESULT: string | null;
  MIN_NRM: string | null;
  MAX_NRM: string | null;
  NRM_UNIT: string | null;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientLabRow[];
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
        AND l.lvstdate >= TO_DATE(:d1, 'YYYY-MM-DD')
        AND l.lvstdate < TO_DATE(:d2, 'YYYY-MM-DD') + 1`;
  }

  const hnValue = typeof hn === "string" && hn.trim() !== "" ? hn.trim() : null;
  const cardnoValue = typeof cardno === "string" && cardno.trim() !== "" ? cardno.trim() : null;
  const nameValue = typeof name === "string" && name.trim() !== "" ? name.trim() : null;

  if (hnValue == null && cardnoValue == null && nameValue == null) {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุอย่างน้อย 1 เงื่อนไข: HN, เลขบัตรประชาชน หรือชื่อ-นามสกุล",
    });
  }

  const whereHn = hnValue != null ? " AND l.hn = :hn" : "";
  const whereCardno = cardnoValue != null ? " AND ptno.cardno = :cardno" : "";
  const whereName =
    nameValue != null
      ? ` AND (
          UPPER(pt.dspname) LIKE '%' || UPPER(TRIM(:name)) || '%'
          OR UPPER(TRIM(NVL(pt.fname, '') || ' ' || NVL(pt.lname, '')))
             LIKE '%' || UPPER(TRIM(:name)) || '%'
        )`
      : "";

  const sql = `
    SELECT
      l.hn                                AS HN,
      ptno.cardno                         AS CARDNO,
      pt.dspname                          AS DSPNAME,
      TRUNC(l.lvstdate)                   AS LAB_DATE,
      l.an                                AS AN,
      CASE WHEN l.an IS NOT NULL THEN 'IPD' ELSE 'OPD' END AS VISIT_TYPE,
      l.labexm                            AS LABEXM,
      le.name                             AS LAB_NAME,
      l.result                            AS RESULT,
      l.minnrm                            AS MIN_NRM,
      l.maxnrm                            AS MAX_NRM,
      l.nrmunit                           AS NRM_UNIT
    FROM lvstexm l
      INNER JOIN pt ON pt.hn = l.hn
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      LEFT JOIN labexm le ON le.labexm = l.labexm
    WHERE 1 = 1
      ${whereDate}
      ${whereHn}
      ${whereCardno}
      ${whereName}
    ORDER BY
      l.lvstdate DESC,
      l.hn,
      le.name,
      l.labexm
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
    const result = await executeQuery<PatientLabRow>(sql, params);
    const rows = result.rows ?? [];

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหารายการ Lab ได้", error);
  }
}
