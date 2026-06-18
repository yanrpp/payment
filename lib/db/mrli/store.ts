/**
 * MRLI store (เฟส 0 — Foundation)
 * เก็บสถานะการเบิก/กฎ/audit ของ MRLI บน MySQL/MariaDB (HosXP Oracle เขียนไม่ได้)
 * ตารางถูกสร้างอัตโนมัติด้วย CREATE TABLE IF NOT EXISTS ครั้งแรกที่เรียกใช้
 */
import { executeQuery, executeUpdate, getMySQLPool } from "@/lib/db/mysql";

export const CLAIM_STATUSES = ["pending", "reviewed", "submitted", "rejected", "no_claim"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type ClaimStatusRow = {
  an: string;
  status: ClaimStatus;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type AuditRow = {
  id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  actor: string | null;
  created_at: string;
};

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS mrli_claim_status (
    an          VARCHAR(32)  NOT NULL,
    status      VARCHAR(32)  NOT NULL DEFAULT 'pending',
    note        VARCHAR(500) NULL,
    updated_by  VARCHAR(128) NULL,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (an)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS mrli_audit_log (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    entity      VARCHAR(32)  NOT NULL,
    entity_key  VARCHAR(64)  NOT NULL,
    action      VARCHAR(32)  NOT NULL,
    old_value   VARCHAR(500) NULL,
    new_value   VARCHAR(500) NULL,
    note        VARCHAR(500) NULL,
    actor       VARCHAR(128) NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_entity (entity, entity_key),
    KEY idx_created (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS mrli_rule (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    rule_code   VARCHAR(64)  NOT NULL,
    fund        VARCHAR(32)  NULL,
    rule_type   VARCHAR(32)  NOT NULL,
    description VARCHAR(500) NULL,
    config_json TEXT         NULL,
    active      TINYINT(1)   NOT NULL DEFAULT 1,
    updated_by  VARCHAR(128) NULL,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rule_code (rule_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

let schemaReady = false;

/** สร้างตาราง MRLI ถ้ายังไม่มี (idempotent) */
export async function ensureMrliSchema(): Promise<void> {
  if (schemaReady) return;
  const pool = getMySQLPool();

  for (const ddl of DDL) {
    // ใช้ query แทน execute เพราะ DDL ไม่รองรับ prepared statement ในบาง MySQL
    await pool.query(ddl);
  }
  schemaReady = true;
}

/** ดึงสถานะการเบิกของหลาย AN */
export async function getClaimStatuses(ans: string[]): Promise<Record<string, ClaimStatusRow>> {
  await ensureMrliSchema();
  const cleaned = ans.map((a) => String(a).trim()).filter((a) => a !== "");

  if (cleaned.length === 0) return {};

  const placeholders = cleaned.map(() => "?").join(", ");
  const rows = await executeQuery<ClaimStatusRow>(
    `SELECT an, status, note, updated_by, updated_at
     FROM mrli_claim_status
     WHERE an IN (${placeholders})`,
    cleaned
  );

  const map: Record<string, ClaimStatusRow> = {};

  for (const r of rows) map[String(r.an)] = r;

  return map;
}

/** ดึงสถานะการเบิกทั้งหมด (ตารางมีเฉพาะ AN ที่เคยบันทึกสถานะไว้ — ขนาดเล็ก) */
export async function getAllClaimStatuses(): Promise<Record<string, ClaimStatusRow>> {
  await ensureMrliSchema();
  const rows = await executeQuery<ClaimStatusRow>(
    `SELECT an, status, note, updated_by, updated_at FROM mrli_claim_status`
  );

  const map: Record<string, ClaimStatusRow> = {};

  for (const r of rows) map[String(r.an)] = r;

  return map;
}

/** บันทึก/อัปเดตสถานะการเบิกของ AN พร้อมเขียน audit log */
export async function setClaimStatus(args: {
  an: string;
  status: ClaimStatus;
  note?: string | null;
  actor?: string | null;
}): Promise<ClaimStatusRow> {
  await ensureMrliSchema();
  const an = String(args.an).trim();
  const status = args.status;
  const note = args.note ?? null;
  const actor = args.actor ?? null;

  const existing = await executeQuery<{ status: string }>(
    `SELECT status FROM mrli_claim_status WHERE an = ?`,
    [an]
  );
  const oldStatus = existing[0]?.status ?? null;

  await executeUpdate(
    `INSERT INTO mrli_claim_status (an, status, note, updated_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), updated_by = VALUES(updated_by)`,
    [an, status, note, actor]
  );

  await executeUpdate(
    `INSERT INTO mrli_audit_log (entity, entity_key, action, old_value, new_value, note, actor)
     VALUES ('claim_status', ?, 'update_status', ?, ?, ?, ?)`,
    [an, oldStatus, status, note, actor]
  );

  const rows = await executeQuery<ClaimStatusRow>(
    `SELECT an, status, note, updated_by, updated_at FROM mrli_claim_status WHERE an = ?`,
    [an]
  );

  return rows[0];
}

/** เขียน audit log แบบทั่วไป (ใช้ร่วมกับโมดูลอื่น เช่น rule admin) */
export async function writeAudit(args: {
  entity: string;
  entityKey: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  note?: string | null;
  actor?: string | null;
}): Promise<void> {
  await ensureMrliSchema();
  await executeUpdate(
    `INSERT INTO mrli_audit_log (entity, entity_key, action, old_value, new_value, note, actor)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      args.entity,
      args.entityKey,
      args.action,
      args.oldValue ?? null,
      args.newValue ?? null,
      args.note ?? null,
      args.actor ?? null,
    ]
  );
}

/** ประวัติ audit ของ AN (ล่าสุดก่อน) */
export async function getAuditForAn(an: string, limit = 50): Promise<AuditRow[]> {
  await ensureMrliSchema();
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));

  return executeQuery<AuditRow>(
    `SELECT id, action, old_value, new_value, note, actor, created_at
     FROM mrli_audit_log
     WHERE entity = 'claim_status' AND entity_key = ?
     ORDER BY id DESC
     LIMIT ${safeLimit}`,
    [String(an).trim()]
  );
}
