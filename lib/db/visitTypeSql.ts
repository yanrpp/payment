/**
 * เงื่อนไข OPD/IPD ตาม HosXP
 * - OPD: ovst.an และ prsc.an ว่าง
 * - IPD: มี AN ใน ovst หรือ prsc (เลข Admit)
 */
export function buildVisitTypeWhereSql(
  includeOpd: boolean,
  includeIpd: boolean,
  ovAlias = "ov",
  prscAlias = "p"
): string {
  if (includeOpd && includeIpd) return "";
  if (includeOpd) {
    return `\n        AND ${ovAlias}.an IS NULL AND ${prscAlias}.an IS NULL`;
  }

  return `\n        AND COALESCE(${ovAlias}.an, ${prscAlias}.an) IS NOT NULL`;
}

/** ดึง AN จาก ovst / prsc */
export function sqlCoalesceAn(ovAlias = "ov", prscAlias = "p"): string {
  return `COALESCE(NULLIF(TRIM(${ovAlias}.an), ''), NULLIF(TRIM(${prscAlias}.an), ''))`;
}
