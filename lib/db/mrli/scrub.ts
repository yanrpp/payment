/**
 * MRLI เฟส 2 — Pre-Claim Scrubbing rule engine
 * กฎตรวจสอบก่อนส่งเบิก: logic อยู่ใน code (registry) ส่วน "เปิด/ปิด + ความรุนแรง"
 * อ่านจากตาราง mrli_rule (rule_type='scrub') — ถ้า MySQL ไม่พร้อมจะ fallback เป็นกฎ default
 * (การแก้กฎแบบ no-code เต็มรูปแบบจะอยู่ในเฟส 3 Admin Portal)
 */
import { executeQuery, executeUpdate } from "@/lib/db/mysql";
import { ensureMrliSchema, writeAudit } from "@/lib/db/mrli/store";

export type ScrubSeverity = "error" | "warning" | "info";

/** สัญญาณต่อ AN ที่ดึงจาก HosXP เพื่อป้อนให้กฎ */
export type ScrubAnData = {
  totalCharge: number;
  dxCount: number | null;
  nonFormularyCount: number;
  drugOrderCount: number;
};

export type ScrubFinding = { code: string; severity: ScrubSeverity; message: string };

type ScrubRuleDef = {
  code: string;
  label: string;
  description: string;
  defaultSeverity: ScrubSeverity;
  defaultActive: boolean;
  evaluate: (d: ScrubAnData) => ScrubFinding | null;
};

export const SCRUB_RULE_DEFS: ScrubRuleDef[] = [
  {
    code: "NO_CHARGE",
    label: "ยังไม่ลงค่าใช้จ่าย",
    description: "ไม่มีรายการเรียกเก็บใน INCPT (ยอด = 0)",
    defaultSeverity: "error",
    defaultActive: true,
    evaluate: (d) =>
      d.totalCharge <= 0
        ? { code: "NO_CHARGE", severity: "error", message: "ยังไม่ลงค่าใช้จ่าย (INCPT = 0)" }
        : null,
  },
  {
    code: "NO_DIAGNOSIS",
    label: "ไม่มีรหัสวินิจฉัย",
    description: "ไม่มี ICD-10 ใน iptdiag",
    defaultSeverity: "error",
    defaultActive: true,
    evaluate: (d) =>
      d.dxCount !== null && d.dxCount <= 0
        ? { code: "NO_DIAGNOSIS", severity: "error", message: "ไม่มีรหัสวินิจฉัย (ICD-10)" }
        : null,
  },
  {
    code: "NON_FORMULARY_OCPA",
    label: "ยานอกบัญชี — ตรวจ OCPA",
    description: "มีรายการยานอกบัญชียาหลัก ต้องตรวจสอบการขออนุมัติเบิก (OCPA)",
    defaultSeverity: "warning",
    defaultActive: true,
    evaluate: (d) =>
      d.nonFormularyCount > 0
        ? {
            code: "NON_FORMULARY_OCPA",
            severity: "warning",
            message: `มียานอกบัญชี ${d.nonFormularyCount} รายการ — ตรวจสอบ OCPA`,
          }
        : null,
  },
  {
    code: "NO_DRUG_ORDER",
    label: "ไม่มีใบสั่งยา",
    description: "ไม่มีใบสั่งยา/เวชภัณฑ์ (prsc) ในการรักษา",
    defaultSeverity: "info",
    defaultActive: false,
    evaluate: (d) =>
      d.drugOrderCount <= 0
        ? { code: "NO_DRUG_ORDER", severity: "info", message: "ไม่มีใบสั่งยา/เวชภัณฑ์" }
        : null,
  },
];

const DEF_BY_CODE = new Map(SCRUB_RULE_DEFS.map((r) => [r.code, r]));

export type ActiveScrubRule = { code: string; severity: ScrubSeverity };

function isSeverity(v: unknown): v is ScrubSeverity {
  return v === "error" || v === "warning" || v === "info";
}

/** seed กฎ scrub เริ่มต้นลง mrli_rule ถ้ายังไม่มี (idempotent) */
export async function ensureDefaultScrubRules(): Promise<void> {
  await ensureMrliSchema();

  for (const def of SCRUB_RULE_DEFS) {
    await executeUpdate(
      `INSERT IGNORE INTO mrli_rule (rule_code, fund, rule_type, description, config_json, active)
       VALUES (?, NULL, 'scrub', ?, ?, ?)`,
      [
        def.code,
        def.description,
        JSON.stringify({ severity: def.defaultSeverity }),
        def.defaultActive ? 1 : 0,
      ]
    );
  }
}

/** อ่านกฎ scrub ที่เปิดใช้งานจาก mrli_rule (override ความรุนแรงได้ผ่าน config_json) */
export async function getActiveScrubRules(): Promise<ActiveScrubRule[]> {
  await ensureDefaultScrubRules();
  const rows = await executeQuery<{ rule_code: string; config_json: string | null }>(
    `SELECT rule_code, config_json FROM mrli_rule WHERE rule_type = 'scrub' AND active = 1`
  );

  const result: ActiveScrubRule[] = [];

  for (const r of rows) {
    const def = DEF_BY_CODE.get(r.rule_code);

    if (!def) continue;
    let severity = def.defaultSeverity;

    try {
      const cfg = r.config_json ? JSON.parse(r.config_json) : null;

      if (cfg && isSeverity(cfg.severity)) severity = cfg.severity;
    } catch {
      // config_json อาจไม่ใช่ JSON — ใช้ค่า default
    }
    result.push({ code: r.rule_code, severity });
  }

  return result;
}

/** กฎ default (ใช้เมื่อ MySQL ไม่พร้อม — ยัง scrub ได้แบบ read-only) */
export function getDefaultActiveScrubRules(): ActiveScrubRule[] {
  return SCRUB_RULE_DEFS.filter((r) => r.defaultActive).map((r) => ({
    code: r.code,
    severity: r.defaultSeverity,
  }));
}

// ---- Admin Portal (เฟส 3): จัดการกฎผ่าน UI ----

export type ScrubRuleAdmin = {
  code: string;
  label: string;
  description: string;
  severity: ScrubSeverity;
  active: boolean;
  inRegistry: boolean;
};

function severityFromConfig(configJson: string | null, fallback: ScrubSeverity): ScrubSeverity {
  try {
    const cfg = configJson ? JSON.parse(configJson) : null;

    if (cfg && isSeverity(cfg.severity)) return cfg.severity;
  } catch {
    // config_json อาจไม่ใช่ JSON
  }

  return fallback;
}

/** รายการกฎ scrub ทั้งหมด (รวมที่ปิดอยู่) + metadata จาก registry สำหรับหน้า Admin */
export async function listScrubRulesAdmin(): Promise<ScrubRuleAdmin[]> {
  await ensureDefaultScrubRules();
  const rows = await executeQuery<{
    rule_code: string;
    description: string | null;
    config_json: string | null;
    active: number;
  }>(
    `SELECT rule_code, description, config_json, active
     FROM mrli_rule WHERE rule_type = 'scrub' ORDER BY rule_code`
  );

  return rows.map((r) => {
    const def = DEF_BY_CODE.get(r.rule_code);

    return {
      code: r.rule_code,
      label: def?.label ?? r.rule_code,
      description: r.description ?? def?.description ?? "",
      severity: severityFromConfig(r.config_json, def?.defaultSeverity ?? "warning"),
      active: Number(r.active) === 1,
      inRegistry: Boolean(def),
    };
  });
}

/** อัปเดตกฎ scrub (เปิด/ปิด, ความรุนแรง, คำอธิบาย) + เขียน audit */
export async function updateScrubRule(args: {
  code: string;
  active?: boolean;
  severity?: ScrubSeverity;
  description?: string | null;
  actor?: string | null;
}): Promise<ScrubRuleAdmin> {
  await ensureMrliSchema();
  const code = args.code;
  const cur = await executeQuery<{
    description: string | null;
    config_json: string | null;
    active: number;
  }>(
    `SELECT description, config_json, active FROM mrli_rule WHERE rule_code = ? AND rule_type = 'scrub'`,
    [code]
  );

  if (cur.length === 0) throw new Error("ไม่พบกฎที่ระบุ");
  const def = DEF_BY_CODE.get(code);
  const oldSeverity = severityFromConfig(cur[0].config_json, def?.defaultSeverity ?? "warning");
  const oldActive = Number(cur[0].active) === 1;
  const oldDesc = cur[0].description ?? def?.description ?? "";

  const newActive = args.active ?? oldActive;
  const newSeverity = args.severity ?? oldSeverity;
  const newDesc = args.description ?? oldDesc;

  await executeUpdate(
    `UPDATE mrli_rule SET active = ?, config_json = ?, description = ?, updated_by = ?
     WHERE rule_code = ? AND rule_type = 'scrub'`,
    [
      newActive ? 1 : 0,
      JSON.stringify({ severity: newSeverity }),
      newDesc,
      args.actor ?? null,
      code,
    ]
  );

  await writeAudit({
    entity: "rule",
    entityKey: code,
    action: "update_rule",
    oldValue: `active=${oldActive};severity=${oldSeverity}`,
    newValue: `active=${newActive};severity=${newSeverity}`,
    actor: args.actor ?? null,
  });

  return {
    code,
    label: def?.label ?? code,
    description: newDesc,
    severity: newSeverity,
    active: newActive,
    inRegistry: Boolean(def),
  };
}

/** ประเมิน AN ตามกฎที่เปิดใช้งาน */
export function evaluateScrub(data: ScrubAnData, active: ActiveScrubRule[]): ScrubFinding[] {
  const findings: ScrubFinding[] = [];

  for (const ar of active) {
    const def = DEF_BY_CODE.get(ar.code);

    if (!def) continue;
    const f = def.evaluate(data);

    if (f) findings.push({ ...f, severity: ar.severity });
  }

  return findings;
}
