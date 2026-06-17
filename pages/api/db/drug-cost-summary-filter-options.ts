import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { buildDrugSourceSql } from "@/lib/db/drugSourceSql";

type OptionRow = { VALUE: string | null };

type SuccessResponse = {
  success: true;
  data: {
    pttype: string[];
    clinic: string[];
    medtype: string[];
    accnation: string[];
  };
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

function normalizeOptions(rows: OptionRow[] | undefined): string[] {
  return (rows ?? [])
    .map((r) => String(r.VALUE ?? "").trim())
    .filter((v) => v !== "")
    .sort((a, b) => a.localeCompare(b, "th"));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  const { d1, d2, opd, ipd } = req.query;

  if (!d1 || !d2 || typeof d1 !== "string" || typeof d2 !== "string") {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุช่วงวันที่ d1 และ d2 (รูปแบบ YYYY-MM-DD)",
    });
  }

  const includeOpd =
    opd == null ? true : String(opd) === "1" || String(opd).toLowerCase() === "true";
  const includeIpd =
    ipd == null ? false : String(ipd) === "1" || String(ipd).toLowerCase() === "true";

  if (!includeOpd && !includeIpd) {
    return res.status(400).json({
      success: false,
      message: "กรุณาเลือกอย่างน้อย 1 ประเภทบริการ (OPD หรือ IPD)",
    });
  }

  const src = buildDrugSourceSql(includeOpd, includeIpd);
  const params = { d1, d2 };
  const whereDate = `WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')${src.whereAnchorSql}`;

  const sqlPttype = `
    SELECT DISTINCT pt.name AS VALUE
    ${src.fromJoinSql}
    ${whereDate}
      AND pt.name IS NOT NULL
    ORDER BY pt.name
  `;

  const sqlClinic = `
    SELECT DISTINCT lct.name AS VALUE
    ${src.fromJoinSql}
    ${whereDate}
      AND lct.name IS NOT NULL
    ORDER BY lct.name
  `;

  const sqlMedtype = `
    SELECT DISTINCT t.name AS VALUE
    ${src.fromJoinSql}
    ${whereDate}
      AND t.name IS NOT NULL
    ORDER BY t.name
  `;

  const sqlAccnation = `
    SELECT DISTINCT a.name AS VALUE
    ${src.fromJoinSql}
    ${whereDate}
      AND a.name IS NOT NULL
    ORDER BY a.name
  `;

  try {
    const [pttypeResult, clinicResult, medtypeResult, accnationResult] = await Promise.all([
      executeQuery<OptionRow>(sqlPttype, params),
      executeQuery<OptionRow>(sqlClinic, params),
      executeQuery<OptionRow>(sqlMedtype, params),
      executeQuery<OptionRow>(sqlAccnation, params),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pttype: normalizeOptions(pttypeResult.rows),
        clinic: normalizeOptions(clinicResult.rows),
        medtype: normalizeOptions(medtypeResult.rows),
        accnation: normalizeOptions(accnationResult.rows),
      },
    });
  } catch (error) {
    return respondError(res, "ไม่สามารถดึงตัวเลือกฟิลเตอร์ได้", error);
  }
}
