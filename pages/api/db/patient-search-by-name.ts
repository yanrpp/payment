import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";

export type PatientSearchRow = {
  HN: string;
  DSPNAME: string | null;
  CARDNO: string | null;
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientSearchRow[];
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

const MAX_RESULTS = 50;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const nameValue = typeof req.query.name === "string" ? req.query.name.trim() : "";

  if (!nameValue) {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุชื่อ-นามสกุลที่ต้องการค้นหา",
    });
  }

  const sql = `
    SELECT * FROM (
      SELECT DISTINCT
        pt.hn        AS HN,
        pt.dspname   AS DSPNAME,
        ptno.cardno  AS CARDNO
      FROM pt
      LEFT JOIN ptno ON pt.hn = ptno.hn AND ptno.notype = 10
      WHERE (
        UPPER(pt.dspname) LIKE '%' || UPPER(TRIM(:name)) || '%'
        OR UPPER(TRIM(NVL(pt.fname, '') || ' ' || NVL(pt.lname, '')))
           LIKE '%' || UPPER(TRIM(:name)) || '%'
      )
      ORDER BY pt.dspname, pt.hn
    )
    WHERE ROWNUM <= ${MAX_RESULTS}
  `;

  try {
    const result = await executeQuery<PatientSearchRow>(sql, { name: nameValue });
    const rows = result.rows ?? [];

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถค้นหารายชื่อผู้ป่วยได้", error);
  }
}
