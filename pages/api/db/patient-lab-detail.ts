import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

/** รายการ lab แต่ละรายการของเคส (lvstexm ต่อ hn + vstdate) */
type PatientLabItemRow = {
  LABEXM: number;
  LVSTDATE: string;
  RESULT: string | null;
};

/** สรุป eGFR ตาม SQL ที่ให้มา (ptdiag + LAG eGFR 3 จุดเวลา) */
type PatientLabEgfrSummaryRow = {
  HN: string;
  VSTDATE: string;
  DIAGDATE: string;
  ICD10: string;
  DIAGTYPE: string;
  DCT: string | null;
  DSPNAME: string | null;
  DATE_A: string | null;
  RES_A: string | null;
  DATE_B: string | null;
  RES_B: string | null;
  DATE_C: string | null;
  RES_C: string | null;
};

type SuccessResponse = {
  success: true;
  labItems: PatientLabItemRow[];
  egfrSummary: PatientLabEgfrSummaryRow[];
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

const ICD10_KIDNEY_RELATED =
  "('N181','N182','N183','N184','N189','E102','E112','E122','E132','E142','N083','I120','I129','I130','I131','I132','I139','I151','N021','N022','N023','N024','N025','N026','N027','N028','N029','N031','N032','N033','N034','N035','N036','N037','N038','N039','N041','N042','N043','N044','N045','N046','N047','N048','N049','N051','N052','N053','N054','N055','N056','N057','N058','N059','N061','N062','N063','N064','N065','N066','N067','N068','N069','N071','N072','N073','N074','N075','N076','N077','N078','N079','N081','N082','N083','N084','N085','N086','N087','N088','N089','N110','N111','N118','N119','N12','N130','N131','N132','N133','N134','N135','N136','N137','N138','N139','N140','N141','N142','N143','N144','N200','N201','N202','N2019','N210','N211','N218','N219','N251','N258','N259','N26','N270','N271','N279','N280','N281','N288','N289','N144','Q610','Q611','Q612','Q613','Q614','Q615','Q618')";

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

  const { hn, vstdate } = req.query;

  if (!hn || !vstdate || typeof hn !== "string" || typeof vstdate !== "string") {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุ hn และ vstdate (รูปแบบ YYYY-MM-DD)",
    });
  }

  const sqlLabItems = `
    SELECT
      lvstexm.labexm   AS LABEXM,
      lvstexm.lvstdate AS LVSTDATE,
      lvstexm.result   AS RESULT
    FROM lvstexm
    WHERE lvstexm.hn = :hn
      AND lvstexm.lvstdate = TO_DATE(:vstdate, 'YYYY-MM-DD')
    ORDER BY lvstexm.labexm
  `;

  const sqlEgfrSummary = `
    SELECT
      HN, VSTDATE, DIAGDATE, ICD10, DIAGTYPE, DCT, DSPNAME,
      DATE_A, RES_A, DATE_B, RES_B, DATE_C, RES_C
    FROM (
      SELECT
        ptdiag.hn AS HN,
        ptdiag.vstdate AS VSTDATE,
        ptdiag.diagdate AS DIAGDATE,
        LISTAGG(ptdiag.icd10, ',') WITHIN GROUP (ORDER BY ptdiag.icd10)
          OVER (PARTITION BY ptdiag.hn, ptdiag.vstdate, ptdiag.vsttime, ptdiag.diagtype) AS ICD10,
        ptdiag.diagtype AS DIAGTYPE,
        ptdiag.dct AS DCT,
        dct.dspname AS DSPNAME,
        lab.date_a AS DATE_A,
        lab.res_a AS RES_A,
        lab.date_b AS DATE_B,
        lab.res_b AS RES_B,
        lab.date_c AS DATE_C,
        lab.res_c AS RES_C,
        ROW_NUMBER() OVER (PARTITION BY ptdiag.hn, ptdiag.vstdate, ptdiag.diagdate ORDER BY ptdiag.diagtype) AS rn
      FROM ptdiag
      LEFT JOIN dct ON ptdiag.dct = dct.dct
      LEFT OUTER JOIN (
        SELECT
          hn,
          lvstdate AS date_a,
          result AS res_a,
          LAG(lvstdate, 1) OVER (PARTITION BY hn ORDER BY lvstdate) AS date_b,
          LAG(result, 1) OVER (PARTITION BY hn ORDER BY lvstdate) AS res_b,
          LAG(lvstdate, 2) OVER (PARTITION BY hn ORDER BY lvstdate) AS date_c,
          LAG(result, 2) OVER (PARTITION BY hn ORDER BY lvstdate) AS res_c
        FROM lvstexm
        WHERE labexm = 1264
          AND result IS NOT NULL
          AND result >= '15' AND result <= '59'
      ) lab ON ptdiag.hn = lab.hn AND ptdiag.vstdate = lab.date_a
      WHERE ptdiag.icd10 IN ${ICD10_KIDNEY_RELATED}
        AND ptdiag.hn = :hn
        AND ptdiag.vstdate = TO_DATE(:vstdate, 'YYYY-MM-DD')
    )
    WHERE rn = 1
    ORDER BY DIAGDATE
  `;

  const params = { hn: hn.trim(), vstdate: vstdate.trim() };

  let labItems: PatientLabItemRow[] = [];
  let egfrSummary: PatientLabEgfrSummaryRow[] = [];

  try {
    const labResult = await executeQuery<PatientLabItemRow>(sqlLabItems, params);
    labItems = labResult.rows ?? [];
  } catch {
    // ตาราง lvstexm อาจไม่มีใน schema (ORA-00942) — คืน labItems เป็น []
  }

  try {
    const egfrResult = await executeQuery<PatientLabEgfrSummaryRow>(sqlEgfrSummary, params);
    egfrSummary = egfrResult.rows ?? [];
  } catch {
    // ตาราง ptdiag หรือ dct อาจไม่มีใน schema (ORA-00942) — คืน egfrSummary เป็น []
  }

  return res.status(200).json({
    success: true,
    labItems,
    egfrSummary,
  });
}
