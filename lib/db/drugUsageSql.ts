/**
 * ข้อความวิธีกินยาที่อ่านเข้าใจ — อิง master ของ HosXP
 * (meduseqty / medusetime / medusetype / medsymptom) แทนการต่อรหัสดิบ
 *
 * หมายเหตุ: medlblhlp1 มักเก็บรหัสย่อ (เช่น NMT4G, Paid) ไม่ใช่ข้อความฉลาก —
 * จึงใช้เฉพาะเมื่อมีตัวอักษรไทย/ช่องว่าง หรือเป็น fallback สุดท้าย
 */

/** JOIN ตาราง master สำหรับแปลรหัสวิธีใช้ยา */
export function sqlDrugUsageJoins(dAlias = "d"): string {
  return `
    LEFT JOIN meduseqty muqty ON muqty.meduseqty = ${dAlias}.meduseqty
    LEFT JOIN medusetime mutm ON mutm.medusetime = ${dAlias}.medusetime
    LEFT JOIN medusetype muty ON muty.medusetype = ${dAlias}.medusetype
    LEFT JOIN medsymptom msym ON msym.medsymptom = ${dAlias}.medsymptom
    LEFT JOIN meduseunit muunit ON muunit.meduseunit = ${dAlias}.meduseunit
    LEFT JOIN medlblhlp mlblhlp ON mlblhlp.medlblhlp = ${dAlias}.medlblhlp1
    LEFT JOIN medlblhlp mlblhlp2 ON mlblhlp2.medlblhlp = ${dAlias}.medlblhlp2`;
}

/** ข้อความวิธีใช้จาก prscdtext (PRSCDTEXT) — join ตาม prscno + sphmlct + itemno */
export function sqlPrscdtextJoin(dAlias = "d"): string {
  return `
    LEFT JOIN (
      SELECT prscno, sphmlct, itemno, MAX(TRIM(medusage)) AS medusage
      FROM prscdtext
      WHERE medusage IS NOT NULL
      GROUP BY prscno, sphmlct, itemno
    ) ptxt ON ptxt.prscno = ${dAlias}.prscno
          AND ptxt.sphmlct = ${dAlias}.sphmlct
          AND ptxt.itemno = ${dAlias}.itemno`;
}

export function sqlPrscdtextMedusageColumn(): string {
  return `TRIM(ptxt.medusage) AS PRSCDTEXT_MEDUSAGE`;
}

function sqlDrugUsageUnitName(): string {
  return `NULLIF(TRIM(COALESCE(NULLIF(TRIM(muunit.thainame), ''), TRIM(muunit.name))), '')`;
}

function sqlDrugUsageMasterText(dAlias: string): string {
  const unit = sqlDrugUsageUnitName();

  return `RTRIM(
    TRIM(muty.name) || ' ' ||
    TRIM(muqty.name) ||
    CASE WHEN ${unit} IS NOT NULL THEN ' ' || ${unit} ELSE '' END ||
    CASE WHEN mutm.name IS NOT NULL THEN ' ' || TRIM(mutm.name) ELSE '' END ||
    CASE WHEN msym.name IS NOT NULL THEN ' ' || TRIM(msym.name) ELSE '' END,
    ' '
  )`;
}

/** คอลัมน์วิธีใช้ยาแยกรายการ — ใช้คู่กับ sqlDrugUsageJoins */
export function sqlDrugUsageFieldColumns(dAlias = "d"): string {
  return `
      TRIM(muty.name)                     AS MEDUSETYPE_NAME,
      TRIM(muqty.name)                    AS MEDUSEQTY_NAME,
      TRIM(mutm.name)                     AS MEDUSETIME_NAME,
      TRIM(msym.name)                     AS MEDSYMPTOM_NAME,
      TRIM(COALESCE(NULLIF(TRIM(muunit.thainame), ''), TRIM(muunit.name))) AS MEDUSEUNIT_NAME,
      TRIM(${dAlias}.medlblhlp1)          AS MEDLBLHLP1,
      TRIM(mlblhlp.name)                  AS MEDLBLHLP_NAME,
      TRIM(mlblhlp2.name)                 AS MEDLBLHLP2_NAME,
      TRIM(${dAlias}.mednote)             AS MEDNOTE`;
}

/** ต่อข้อความช่วยฉลาก (medlblhlp) ต่อท้าย — HosXP แสดงต่อจาก master usage */
function sqlAppendThaiLabelHelp(baseExpr: string, helpExpr: string): string {
  return `CASE
    WHEN ${helpExpr} IS NOT NULL AND REGEXP_LIKE(${helpExpr}, '[ก-๙]')
      AND (${baseExpr} IS NULL OR INSTR(${baseExpr}, ${helpExpr}) = 0)
    THEN CASE WHEN ${baseExpr} IS NOT NULL AND ${baseExpr} <> '' THEN ' ' ELSE '' END || ${helpExpr}
    ELSE ''
  END`;
}

function sqlDrugUsageReadableCore(dAlias: string): string {
  const master = sqlDrugUsageMasterText(dAlias);
  const lbl = `TRIM(${dAlias}.medlblhlp1)`;
  const note = `TRIM(${dAlias}.mednote)`;

  return `TRIM(
    COALESCE(
      CASE
        WHEN ${lbl} IS NOT NULL AND REGEXP_LIKE(${lbl}, '[ก-๙]')
        THEN ${lbl}
        ELSE NULL
      END,
      CASE
        WHEN REGEXP_LIKE(${master}, '[ก-๙]')
        THEN NULLIF(${master}, '')
        ELSE NULL
      END,
      NULLIF(${note}, ''),
      CASE
        WHEN ${master} IS NOT NULL
          AND NOT REGEXP_LIKE(TRIM(${master}), '^[.\\s]+$')
        THEN NULLIF(TRIM(${master}), '')
        ELSE NULL
      END,
      CASE
        WHEN ${lbl} IS NOT NULL
          AND NOT REGEXP_LIKE(${lbl}, '^[A-Za-z0-9]+$')
        THEN ${lbl}
        ELSE NULL
      END
    )
  )`;
}

/** นิพจน์ข้อความวิธีกินยา — master + คำแนะนำฉลากจาก medlblhlp1/2 */
export function sqlDrugUsageReadable(dAlias = "d"): string {
  const core = sqlDrugUsageReadableCore(dAlias);
  const hlp1 = `TRIM(mlblhlp.name)`;
  const hlp2 = `TRIM(mlblhlp2.name)`;

  return `TRIM(RTRIM(
    ${core} ||
    ${sqlAppendThaiLabelHelp(core, hlp1)} ||
    ${sqlAppendThaiLabelHelp(core, hlp2)},
    ' '
  ))`;
}

/** นิพจน์โดสยาต่อครั้ง — จาก meduseqty + meduseunit หรือฟิลด์คำนวณใน prscdt */
export function sqlDrugDoseReadable(dAlias = "d"): string {
  const qtyName = `TRIM(muqty.name)`;
  const unitName = sqlDrugUsageUnitName();

  return `TRIM(
    COALESCE(
      NULLIF(TRIM(TO_CHAR(${dAlias}.dosecalculated)), ''),
      CASE
        WHEN ${qtyName} IS NOT NULL
          AND NOT REGEXP_LIKE(${qtyName}, '^[.\\s]+$')
        THEN TRIM(${qtyName} || CASE WHEN ${unitName} IS NOT NULL THEN ' ' || ${unitName} ELSE '' END)
        ELSE NULL
      END,
      NULLIF(TRIM(TO_CHAR(${dAlias}.smddose)), ''),
      NULLIF(TRIM(${dAlias}.unitnm), '')
    )
  )`;
}
