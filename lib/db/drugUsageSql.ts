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
    LEFT JOIN meduseunit muunit ON muunit.meduseunit = ${dAlias}.meduseunit`;
}

/** ข้อความวิธีใช้จาก prscdtext — join แบบ 1 แถวต่อ prscno+meditem */
export function sqlPrscdtextJoin(dAlias = "d"): string {
  const medusageExpr = `TRIM(COALESCE(DBMS_LOB.SUBSTR(medusage, 4000, 1), CAST(medusage AS VARCHAR2(4000))))`;

  return `
    LEFT JOIN (
      SELECT prscno, meditem, MAX(${medusageExpr}) AS medusage
      FROM prscdtext
      GROUP BY prscno, meditem
    ) ptxt_line ON ptxt_line.prscno = ${dAlias}.prscno
               AND TO_CHAR(ptxt_line.meditem) = TO_CHAR(${dAlias}.meditem)
    LEFT JOIN (
      SELECT prscno, MAX(${medusageExpr}) AS medusage
      FROM prscdtext
      GROUP BY prscno
    ) ptxt_hdr ON ptxt_hdr.prscno = ${dAlias}.prscno`;
}

export function sqlPrscdtextMedusageColumn(): string {
  return `TRIM(COALESCE(ptxt_line.medusage, ptxt_hdr.medusage)) AS PRSCDTEXT_MEDUSAGE`;
}

function sqlDrugUsageMasterText(dAlias: string): string {
  return `RTRIM(
    TRIM(muty.name) || ' ' ||
    TRIM(muqty.name) || ' ' ||
    TRIM(mutm.name) ||
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
      TRIM(muunit.name)                   AS MEDUSEUNIT_NAME,
      TRIM(${dAlias}.medlblhlp1)          AS MEDLBLHLP1,
      TRIM(${dAlias}.mednote)             AS MEDNOTE`;
}

/** นิพจน์ข้อความวิธีกินยา — ลำดับ: ฉลากไทย → master ไทย → หมายเหตุ → master → ฉลากที่ไม่ใช่รหัส */
export function sqlDrugUsageReadable(dAlias = "d"): string {
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

/** นิพจน์โดสยาต่อครั้ง — จาก meduseqty + meduseunit หรือฟิลด์คำนวณใน prscdt */
export function sqlDrugDoseReadable(dAlias = "d"): string {
  const qtyName = `TRIM(muqty.name)`;
  const unitName = `TRIM(muunit.name)`;

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
