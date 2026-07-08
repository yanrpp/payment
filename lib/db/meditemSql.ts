/**
 * นิพจน์ SQL สำหรับข้อมูลเวชภัณฑ์จากตาราง meditem
 */

/** ความแรง/ขนาดยา — อิงฟิลด์「ความแรง」ใน HosXP (strength หรือ strength2 + strengthunit) */
export function sqlDrugStrength(mAlias = "m"): string {
  return `NULLIF(TRIM(
    COALESCE(
      NULLIF(TRIM(${mAlias}.strength), ''),
      CASE
        WHEN ${mAlias}.strength2 IS NOT NULL THEN
          TRIM(
            TRIM(TO_CHAR(${mAlias}.strength2)) ||
            CASE
              WHEN ${mAlias}.strengthunit IS NOT NULL AND TRIM(${mAlias}.strengthunit) <> ''
              THEN ' ' || TRIM(${mAlias}.strengthunit)
              ELSE ''
            END
          )
        ELSE NULL
      END
    )
  ), '')`;
}
