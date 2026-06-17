import { sqlCoalesceAn } from "@/lib/db/visitTypeSql";

/**
 * แหล่งข้อมูล (FROM/JOIN + เงื่อนไข anchor) สำหรับ query ค่ายา/เวชภัณฑ์จาก prsc/prscdt
 *
 * เหตุผล: query เดิมใช้ `INNER JOIN ovst ov ON ov.vn = p.vn` ซึ่งสำหรับผู้ป่วยใน (IPD)
 * ใบสั่งยาส่วนใหญ่ไม่มี vn ที่ตรงกับ ovst → ถูกตัดทิ้งเกือบหมด ทำให้ข้อมูล IPD น้อยผิดปกติ
 * จึงแยกแหล่งข้อมูลตามประเภทบริการ:
 *  - IPD เท่านั้น → ยึดจากตารางผู้ป่วยใน IPT (prsc.an = ipt.an)
 *  - OPD หรือ OPD+IPD → ยึดจาก ovst เหมือนเดิม
 *
 * alias ที่ใช้: p=prsc, d=prscdt, m=meditem, t=medtype, a=medaccnation, lct, pt=pttype, ipt
 */
export type DrugSourceSql = {
  /** ส่วน FROM ... JOIN ... (ไม่รวม WHERE) */
  fromJoinSql: string;
  /** เงื่อนไขต่อท้าย WHERE (ขึ้นต้นด้วย newline + AND ถ้ามี) เช่น ขอบเขตประเภทบริการ / canceldate */
  whereAnchorSql: string;
  /** นิพจน์ AN ของแถว */
  anExpr: string;
  /** นิพจน์ระบุ visit/admission ที่ไม่ซ้ำ ใช้ทำ VISIT_KEY */
  visitKeyExpr: string;
  /** นิพจน์สำหรับ COUNT(DISTINCT ...) จำนวน visit/admission ที่มีการจ่ายยา */
  visitCountExpr: string;
};

export function buildDrugSourceSql(includeOpd: boolean, includeIpd: boolean): DrugSourceSql {
  if (includeIpd && !includeOpd) {
    return {
      fromJoinSql: `
      FROM ipt
      INNER JOIN prsc p ON p.an = ipt.an
      INNER JOIN prscdt d ON p.prscno = d.prscno
      INNER JOIN meditem m ON d.meditem = m.meditem
      INNER JOIN medtype t ON t.medtype = m.medtype
      INNER JOIN medaccnation a ON a.accnation = m.accnation
      LEFT JOIN lct ON d.sphmlct = lct.lct
      LEFT JOIN pttype pt ON pt.pttype = p.pttype`,
      whereAnchorSql: "",
      anExpr: "ipt.an",
      visitKeyExpr: "ipt.an",
      visitCountExpr: "ipt.an",
    };
  }

  const anExpr = sqlCoalesceAn();
  // OPD เท่านั้น = ไม่มี AN ทั้ง ovst และ prsc · OPD+IPD = ไม่จำกัด
  const visitTypeWhere =
    includeOpd && includeIpd ? "" : "\n        AND ov.an IS NULL AND p.an IS NULL";

  return {
    fromJoinSql: `
      FROM prsc p
      INNER JOIN prscdt d ON p.prscno = d.prscno
      INNER JOIN ovst ov ON ov.vn = p.vn
      INNER JOIN meditem m ON d.meditem = m.meditem
      INNER JOIN medtype t ON t.medtype = m.medtype
      INNER JOIN medaccnation a ON a.accnation = m.accnation
      LEFT JOIN lct ON d.sphmlct = lct.lct
      LEFT JOIN pttype pt ON pt.pttype = p.pttype`,
    whereAnchorSql: `${visitTypeWhere}\n        AND ov.canceldate IS NULL`,
    anExpr,
    visitKeyExpr: `CASE
          WHEN ${anExpr} IS NOT NULL THEN
            ${anExpr} || ':' || COALESCE(NULLIF(TRIM(p.vn), ''), TO_CHAR(p.prscno))
          ELSE COALESCE(
            NULLIF(TRIM(p.vn), ''),
            p.hn || ':' || TO_CHAR(TRUNC(p.prscdate), 'YYYYMMDD') || ':' || TO_CHAR(p.prscno)
          )
        END`,
    visitCountExpr: "ov.vn",
  };
}
