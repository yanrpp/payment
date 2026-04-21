import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

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

  const includeOpd = opd == null ? true : String(opd) === "1" || String(opd).toLowerCase() === "true";
  const includeIpd = ipd == null ? false : String(ipd) === "1" || String(ipd).toLowerCase() === "true";

  if (!includeOpd && !includeIpd) {
    return res.status(400).json({
      success: false,
      message: "กรุณาเลือกอย่างน้อย 1 ประเภทบริการ (OPD หรือ IPD)",
    });
  }

  const whereVisitTypeSql =
    includeOpd && includeIpd
      ? ""
      : includeOpd
        ? "\n      AND ov.an IS NULL"
        : "\n      AND ov.an IS NOT NULL";

  const params = { d1, d2 };

  const sqlPttype = `
    SELECT DISTINCT pt.name AS VALUE
    FROM pttype pt
    WHERE pt.name IS NOT NULL
    ORDER BY pt.name
  `;

  const sqlClinic = `
    SELECT DISTINCT l.name AS VALUE
    FROM prsc p
    INNER JOIN prscdt d ON p.prscno = d.prscno
    INNER JOIN ovst ov ON ov.vn = p.vn
    LEFT JOIN lct l ON l.lct = d.sphmlct
    WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
      ${whereVisitTypeSql}
      AND ov.canceldate IS NULL
      AND l.name IS NOT NULL
    ORDER BY l.name
  `;

  const sqlMedtype = `
    SELECT DISTINCT t.name AS VALUE
    FROM prsc p
    INNER JOIN prscdt d ON p.prscno = d.prscno
    INNER JOIN ovst ov ON ov.vn = p.vn
    INNER JOIN meditem m ON d.meditem = m.meditem
    INNER JOIN medtype t ON t.medtype = m.medtype
    WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
      ${whereVisitTypeSql}
      AND ov.canceldate IS NULL
      AND t.name IS NOT NULL
    ORDER BY t.name
  `;

  const sqlAccnation = `
    SELECT DISTINCT a.name AS VALUE
    FROM prsc p
    INNER JOIN prscdt d ON p.prscno = d.prscno
    INNER JOIN ovst ov ON ov.vn = p.vn
    INNER JOIN meditem m ON d.meditem = m.meditem
    INNER JOIN medaccnation a ON a.accnation = m.accnation
    WHERE p.prscdate BETWEEN TO_DATE(:d1, 'YYYY-MM-DD') AND TO_DATE(:d2, 'YYYY-MM-DD')
      ${whereVisitTypeSql}
      AND ov.canceldate IS NULL
      AND a.name IS NOT NULL
    ORDER BY a.name
  `;

  try {
    const [pttypeResult, clinicResult, medtypeResult, accnationResult] = await Promise.all([
      executeQuery<OptionRow>(sqlPttype, {}),
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      success: false,
      message: "ไม่สามารถดึงตัวเลือกฟิลเตอร์ได้",
      error: errorMessage,
    });
  }
}
