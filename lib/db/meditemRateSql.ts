/**
 * นิพจน์ SQL สำหรับต้นทุน/ราคาขายต่อหน่วยของยา/เวชภัณฑ์
 *
 * อิงเรตล่าสุดจาก MEDITEMSALEHST ที่มีผล ณ วันสั่งยา (prscdate) — เป็นวิธีเดียวกับที่ใช้ใน
 * หน้า "สรุปต้นทุนและกำไรจากยา" (drug-cost-summary) เพื่อให้ตัวเลขต้นทุน/กำไรสอดคล้องกันทั้งระบบ
 * (prscdt.costrate/salerate มักไม่ถูกตั้งค่า จึงต้อง fallback ไปที่เรตล่าสุดของ meditem)
 *
 * @param mAlias alias ของตาราง meditem (ต้องมีคอลัมน์ meditem)
 * @param dAlias alias ของตาราง prscdt (ต้องมี costrate/salerate)
 * @param pAlias alias ของตาราง prsc (ต้องมี prscdate)
 */
export function sqlUnitCost(mAlias = "m", dAlias = "d", pAlias = "p"): string {
  return `COALESCE(
    NULLIF(
      (
        SELECT MAX(ms.costrate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
        FROM MEDITEMSALEHST ms
        WHERE ms.meditem = ${mAlias}.meditem
          AND ms.effectdate <= TRUNC(${pAlias}.prscdate)
      ),
      0
    ),
    (
      SELECT MAX(ms.salerate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
      FROM MEDITEMSALEHST ms
      WHERE ms.meditem = ${mAlias}.meditem
        AND ms.effectdate <= TRUNC(${pAlias}.prscdate)
    ),
    NULLIF(${dAlias}.costrate, 0),
    ${dAlias}.salerate
  )`;
}

/** ราคาขายต่อหน่วย — เรตล่าสุดจาก MEDITEMSALEHST, fallback เป็น prscdt.salerate */
export function sqlUnitSale(mAlias = "m", dAlias = "d", pAlias = "p"): string {
  return `COALESCE(
    (
      SELECT MAX(ms.salerate) KEEP (DENSE_RANK LAST ORDER BY ms.effectdate)
      FROM MEDITEMSALEHST ms
      WHERE ms.meditem = ${mAlias}.meditem
        AND ms.effectdate <= TRUNC(${pAlias}.prscdate)
    ),
    ${dAlias}.salerate,
    0
  )`;
}
