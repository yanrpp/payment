/**
 * ข้อความวิธีกินยาที่อ่านเข้าใจ — อิง master ของ HosXP
 * (meduseqty / medusetime / medusetype / medsymptom) แทนการต่อรหัสดิบ
 */

/** JOIN ตาราง master สำหรับแปลรหัสวิธีใช้ยา */
export function sqlDrugUsageJoins(dAlias = "d"): string {
  return `
    LEFT JOIN meduseqty muqty ON muqty.meduseqty = ${dAlias}.meduseqty
    LEFT JOIN medusetime mutm ON mutm.medusetime = ${dAlias}.medusetime
    LEFT JOIN medusetype muty ON muty.medusetype = ${dAlias}.medusetype
    LEFT JOIN medsymptom msym ON msym.medsymptom = ${dAlias}.medsymptom`;
}

/** นิพจน์ข้อความวิธีกินยา — ลำดับ: ฉลากช่วย → ประเภท+จำนวน+ความถี่+อาการ → หมายเหตุ */
export function sqlDrugUsageReadable(dAlias = "d"): string {
  return `TRIM(
    COALESCE(
      NULLIF(TRIM(${dAlias}.medlblhlp1), ''),
      NULLIF(TRIM(
        RTRIM(
          TRIM(muty.name) || ' ' ||
          TRIM(muqty.name) || ' ' ||
          TRIM(mutm.name) ||
          CASE WHEN msym.name IS NOT NULL THEN ' ' || TRIM(msym.name) ELSE '' END,
          ' '
        )
      ), ''),
      NULLIF(TRIM(${dAlias}.mednote), '')
    )
  )`;
}
