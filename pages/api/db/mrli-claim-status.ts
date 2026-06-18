import type { NextApiRequest, NextApiResponse } from "next";

import {
  CLAIM_STATUSES,
  getAllClaimStatuses,
  getAuditForAn,
  getClaimStatuses,
  setClaimStatus,
  type ClaimStatus,
} from "@/lib/db/mrli/store";

function parsePipeList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join("|") : value;

  return raw
    .split("|")
    .map((v) => v.trim())
    .filter((v) => v !== "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const auditAn = typeof req.query.auditAn === "string" ? req.query.auditAn.trim() : "";

      if (auditAn) {
        const audit = await getAuditForAn(auditAn);

        return res.status(200).json({ success: true, audit });
      }

      const ans = parsePipeList(req.query.ans as string | string[] | undefined);
      const statuses = ans.length > 0 ? await getClaimStatuses(ans) : await getAllClaimStatuses();

      return res.status(200).json({ success: true, statuses });
    }

    if (req.method === "POST") {
      const body = (req.body ?? {}) as {
        an?: string;
        status?: string;
        note?: string;
        actor?: string;
      };
      const an = typeof body.an === "string" ? body.an.trim() : "";
      const status = body.status as ClaimStatus;

      if (!an) {
        return res.status(400).json({ success: false, message: "กรุณาระบุ AN" });
      }
      if (!CLAIM_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `สถานะไม่ถูกต้อง (ใช้ได้: ${CLAIM_STATUSES.join(", ")})`,
        });
      }

      const updated = await setClaimStatus({
        an,
        status,
        note: typeof body.note === "string" ? body.note : null,
        actor:
          typeof body.actor === "string" && body.actor.trim() !== "" ? body.actor.trim() : null,
      });

      return res.status(200).json({ success: true, status: updated });
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[API] MRLI claim-status:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    // ส่วนใหญ่เกิดจาก MySQL store ยังไม่ได้ตั้งค่า (DB_* env) หรือเชื่อมต่อไม่ได้
    return res.status(503).json({
      success: false,
      storeUnavailable: true,
      message:
        "MRLI store ยังไม่พร้อมใช้งาน — ตรวจสอบการตั้งค่า MySQL (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME)",
      error: process.env.NODE_ENV !== "production" ? message : undefined,
    });
  }
}
