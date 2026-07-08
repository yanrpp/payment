import type { NextApiRequest, NextApiResponse } from "next";

import { respondError } from "@/lib/api/respond";
import { executeQuery } from "@/lib/db/connection";
import { normalizeHnInput } from "@/lib/hn/normalize";

export type PatientRegistrationInformer = {
  ITEMNO: number | null;
  PREFIX_NAME: string | null;
  FIRST_NAME: string | null;
  LAST_NAME: string | null;
  RELATION_NAME: string | null;
  ADDRESS: string | null;
  PHONE: string | null;
  MOBILE_PHONE: string | null;
};

export type PatientRegistrationData = {
  HN: string;
  DSPNAME: string | null;
  FNAME: string | null;
  LNAME: string | null;
  MIDDLENAME: string | null;
  NICKNAME: string | null;
  EFNAME: string | null;
  ELNAME: string | null;
  PREFIX_NAME: string | null;
  SEX_NAME: string | null;
  MALE: number | null;
  BELONG_NAME: string | null;
  VIP_NAME: string | null;
  BRTHDATE: string | null;
  AGE_YMD: string | null;
  NTNLTY_NAME: string | null;
  CTZSHP_NAME: string | null;
  RLGN_NAME: string | null;
  MRTLST_NAME: string | null;
  BLOODGRP_NAME: string | null;
  OCCPTN_NAME: string | null;
  PTMORPHOLOGY: string | null;
  NOTYPE: number | null;
  NOTYPE_NAME: string | null;
  CARDNO: string | null;
  ALLERGYST: number | null;
  ALLERGYST_LABEL: string | null;
  ALLERGY: string | null;
  ADDRESS: string | null;
  SOI: string | null;
  STREET: string | null;
  TUMBON_CODE: number | null;
  TUMBON_NAME: string | null;
  AMPUR_NAME: string | null;
  CHANGWAT_NAME: string | null;
  DISTRICT_TEXT: string | null;
  ZIPCODE: string | null;
  COUNTRY_NAME: string | null;
  MOBILE_PHONE: string | null;
  PHONE: string | null;
  INFORMERS: PatientRegistrationInformer[];
};

type SuccessResponse = {
  success: true;
  count: number;
  data: PatientRegistrationData | null;
};

type ErrorResponse = {
  success: false;
  message: string;
  error?: string;
};

function sexName(male: number | null | undefined): string | null {
  if (male === 1) return "ชาย";
  if (male === 2) return "หญิง";
  if (male == null) return null;

  return String(male);
}

function allergyLabel(code: number | null | undefined): string | null {
  if (code == null) return null;
  if (code === 1) return "ไม่ทราบประวัติการแพ้ยา";
  if (code === 2) return "ไม่มีประวัติการแพ้ยา";
  if (code === 3) return "มีประวัติแพ้ยา";

  return `รหัส ${code}`;
}

function formatAgeYmd(birth: Date | null, asOf = new Date()): string | null {
  if (!birth || Number.isNaN(birth.getTime())) return null;

  let years = asOf.getFullYear() - birth.getFullYear();
  let months = asOf.getMonth() - birth.getMonth();
  let days = asOf.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(asOf.getFullYear(), asOf.getMonth(), 0);

    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;

  return `${years}-${months}-${days}`;
}

function parseOracleDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value).trim();

  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);

  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const d = new Date(raw);

  return Number.isNaN(d.getTime())
    ? null
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toIsoDate(value: unknown): string | null {
  const d = parseOracleDate(value);

  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

type PtRow = {
  HN: string | number;
  DSPNAME: string | null;
  FNAME: string | null;
  LNAME: string | null;
  MIDDLENAME: string | null;
  NICKNAME: string | null;
  EFNAME: string | null;
  ELNAME: string | null;
  PREFIX_NAME: string | null;
  MALE: number | null;
  BELONG_NAME: string | null;
  VIP_NAME: string | null;
  BRTHDATE: string | Date | null;
  NTNLTY_NAME: string | null;
  CTZSHP_NAME: string | null;
  RLGN_NAME: string | null;
  MRTLST_NAME: string | null;
  BLOODGRP_NAME: string | null;
  OCCPTN_NAME: string | null;
  PTMORPHOLOGY: string | null;
  NOTYPE: number | null;
  NOTYPE_NAME: string | null;
  CARDNO: string | null;
  ALLERGYST: number | null;
  ALLERGY: string | null;
};

type AddrRow = {
  ADDRESS: string | null;
  SOI: string | null;
  STREET: string | null;
  TUMBON: number | null;
  TUMBON_NAME: string | null;
  AMPUR_NAME: string | null;
  CHANGWAT_NAME: string | null;
  ZIPCODE: string | null;
  COUNTRY_NAME: string | null;
  PHONE: string | null;
  MOBILEPHONE: string | null;
};

type InformerRow = {
  ITEMNO: number | null;
  PREFIX_NAME: string | null;
  FIRST_NAME: string | null;
  LAST_NAME: string | null;
  RELATION_NAME: string | null;
  ADDRESS: string | null;
  PHONE: string | null;
  MOBILE_PHONE: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const rawHn = typeof req.query.hn === "string" ? req.query.hn.trim() : "";
  const rawCardno = typeof req.query.cardno === "string" ? req.query.cardno.trim() : "";
  const hnValue = rawHn ? normalizeHnInput(rawHn) : "";
  const cardnoValue = rawCardno.replace(/\D/g, "");

  if (!hnValue && !cardnoValue) {
    return res.status(400).json({
      success: false,
      message: "กรุณาระบุ HN หรือเลขบัตรประชาชน",
    });
  }

  const whereHn = hnValue ? "pt.hn = :hn" : "1=0";
  const whereCard =
    cardnoValue && !hnValue
      ? `EXISTS (
          SELECT 1 FROM ptno pn
          WHERE pn.hn = pt.hn AND pn.notype = 10 AND pn.cardno = :cardno
        )`
      : "1=1";

  const params: Record<string, string> = {};

  if (hnValue) params.hn = hnValue;
  if (cardnoValue && !hnValue) params.cardno = cardnoValue;

  const ptSql = `
    SELECT
      pt.hn AS HN,
      pt.dspname AS DSPNAME,
      pt.fname AS FNAME,
      pt.lname AS LNAME,
      pt.middlename AS MIDDLENAME,
      pt.nickname AS NICKNAME,
      pt.efname AS EFNAME,
      pt.elname AS ELNAME,
      pn.name AS PREFIX_NAME,
      pt.male AS MALE,
      bl.name AS BELONG_NAME,
      vip.name AS VIP_NAME,
      TO_CHAR(pt.brthdate, 'YYYY-MM-DD') AS BRTHDATE,
      ntn.name AS NTNLTY_NAME,
      ctz.name AS CTZSHP_NAME,
      rl.name AS RLGN_NAME,
      mr.name AS MRTLST_NAME,
      bg.name AS BLOODGRP_NAME,
      oc.name AS OCCPTN_NAME,
      pt.ptmorphology AS PTMORPHOLOGY,
      pt.notype AS NOTYPE,
      nt.name AS NOTYPE_NAME,
      (
        SELECT pn2.cardno
        FROM ptno pn2
        WHERE pn2.hn = pt.hn
          AND pn2.notype = NVL(pt.notype, 10)
          AND ROWNUM = 1
      ) AS CARDNO,
      pt.allergyst AS ALLERGYST,
      pt.allergy AS ALLERGY
    FROM pt
    LEFT JOIN pname pn ON pn.pname = pt.pname
    LEFT JOIN belong bl ON bl.belong = pt.belong
    LEFT JOIN vip ON vip.vip = pt.vip
    LEFT JOIN ntnlty ntn ON ntn.ntnlty = pt.ntnlty
    LEFT JOIN ntnlty ctz ON ctz.ntnlty = pt.ctzshp
    LEFT JOIN rlgn rl ON rl.rlgn = pt.rlgn
    LEFT JOIN mrtlst mr ON mr.mrtlst = pt.mrtlst
    LEFT JOIN bloodgrp bg ON bg.bloodgrp = pt.bloodgrp
    LEFT JOIN occptn oc ON oc.occptn = pt.occptn
    LEFT JOIN notype nt ON nt.notype = pt.notype
    WHERE ${whereHn}
      AND ${whereCard}
      AND pt.canceldate IS NULL
      AND ROWNUM = 1
  `;

  try {
    const ptResult = await executeQuery<PtRow>(ptSql, params);
    const pt = ptResult.rows?.[0];

    if (!pt) {
      return res.status(200).json({ success: true, count: 0, data: null });
    }

    const hn = String(pt.HN);

    const [addrResult, informerResult] = await Promise.all([
      executeQuery<AddrRow>(
        `
        SELECT * FROM (
          SELECT
            a.address AS ADDRESS,
            a.soi AS SOI,
            a.street AS STREET,
            a.tumbon AS TUMBON,
            tb.name AS TUMBON_NAME,
            ap.name AS AMPUR_NAME,
            cw.name AS CHANGWAT_NAME,
            a.zipcode AS ZIPCODE,
            c.name AS COUNTRY_NAME,
            a.phone AS PHONE,
            a.mobilephone AS MOBILEPHONE
          FROM ptaddr a
          LEFT JOIN tumbon tb
            ON tb.tumbon = a.tumbon AND tb.ampur = a.ampur AND tb.changwat = a.changwat
          LEFT JOIN ampur ap
            ON ap.ampur = a.ampur AND ap.changwat = a.changwat
          LEFT JOIN changwat cw ON cw.changwat = a.changwat
          LEFT JOIN country c ON c.country = a.country
          WHERE a.hn = :hn
            AND a.addrtype = 10
          ORDER BY NVL(a.addrflag, 0) DESC, a.addrdate DESC NULLS LAST, a.addrtime DESC NULLS LAST
        )
        WHERE ROWNUM = 1
        `,
        { hn }
      ),
      executeQuery<InformerRow>(
        `
        SELECT
          i.itemno AS ITEMNO,
          pn.name AS PREFIX_NAME,
          i.inffname AS FIRST_NAME,
          i.inflname AS LAST_NAME,
          pr.name AS RELATION_NAME,
          i.address AS ADDRESS,
          i.phone AS PHONE,
          COALESCE(i.mobilephone, i.phone) AS MOBILE_PHONE
        FROM ptinformer i
        LEFT JOIN pname pn ON pn.pname = i.pname
        LEFT JOIN prsnrlt pr ON pr.prsnrlt = i.prsnrlt
        WHERE i.hn = :hn
        ORDER BY i.itemno
        `,
        { hn }
      ),
    ]);

    const addr = addrResult.rows?.[0] ?? null;
    const informers = informerResult.rows ?? [];
    const tumbonCode = addr?.TUMBON ?? null;
    const districtParts = [
      addr?.TUMBON_NAME ? `แขวง${addr.TUMBON_NAME}` : null,
      addr?.AMPUR_NAME ? `เขต${addr.AMPUR_NAME}` : null,
      addr?.CHANGWAT_NAME ? `จ.${addr.CHANGWAT_NAME}` : null,
    ].filter(Boolean);
    const districtText =
      tumbonCode != null || districtParts.length > 0
        ? [tumbonCode != null ? String(tumbonCode) : null, districtParts.join(" ")]
            .filter(Boolean)
            .join(" ")
        : null;

    const birthIso = toIsoDate(pt.BRTHDATE);
    const ageYmd = formatAgeYmd(parseOracleDate(pt.BRTHDATE));

    const data: PatientRegistrationData = {
      HN: hn,
      DSPNAME: pt.DSPNAME,
      FNAME: pt.FNAME,
      LNAME: pt.LNAME,
      MIDDLENAME: pt.MIDDLENAME,
      NICKNAME: pt.NICKNAME,
      EFNAME: pt.EFNAME,
      ELNAME: pt.ELNAME,
      PREFIX_NAME: pt.PREFIX_NAME,
      SEX_NAME: sexName(pt.MALE),
      MALE: pt.MALE,
      BELONG_NAME: pt.BELONG_NAME,
      VIP_NAME: pt.VIP_NAME,
      BRTHDATE: birthIso,
      AGE_YMD: ageYmd,
      NTNLTY_NAME: pt.NTNLTY_NAME,
      CTZSHP_NAME: pt.CTZSHP_NAME,
      RLGN_NAME: pt.RLGN_NAME,
      MRTLST_NAME: pt.MRTLST_NAME,
      BLOODGRP_NAME: pt.BLOODGRP_NAME,
      OCCPTN_NAME: pt.OCCPTN_NAME,
      PTMORPHOLOGY: pt.PTMORPHOLOGY,
      NOTYPE: pt.NOTYPE,
      NOTYPE_NAME: pt.NOTYPE_NAME,
      CARDNO: pt.CARDNO,
      ALLERGYST: pt.ALLERGYST,
      ALLERGYST_LABEL: allergyLabel(pt.ALLERGYST),
      ALLERGY: pt.ALLERGY,
      ADDRESS: addr?.ADDRESS ?? null,
      SOI: addr?.SOI ?? null,
      STREET: addr?.STREET ?? null,
      TUMBON_CODE: tumbonCode,
      TUMBON_NAME: addr?.TUMBON_NAME ?? null,
      AMPUR_NAME: addr?.AMPUR_NAME ?? null,
      CHANGWAT_NAME: addr?.CHANGWAT_NAME ?? null,
      DISTRICT_TEXT: districtText,
      ZIPCODE: addr?.ZIPCODE ?? null,
      COUNTRY_NAME: addr?.COUNTRY_NAME ?? null,
      MOBILE_PHONE: addr?.MOBILEPHONE ?? addr?.PHONE ?? null,
      PHONE: addr?.PHONE ?? null,
      INFORMERS: informers.map((row) => ({
        ITEMNO: row.ITEMNO,
        PREFIX_NAME: row.PREFIX_NAME,
        FIRST_NAME: row.FIRST_NAME,
        LAST_NAME: row.LAST_NAME,
        RELATION_NAME: row.RELATION_NAME,
        ADDRESS: row.ADDRESS,
        PHONE: row.PHONE,
        MOBILE_PHONE: row.MOBILE_PHONE,
      })),
    };

    return res.status(200).json({ success: true, count: 1, data });
  } catch (error) {
    return respondError(res, "ไม่สามารถโหลดข้อมูลทะเบียนผู้ป่วยได้", error);
  }
}
