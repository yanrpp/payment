import type { NextApiRequest, NextApiResponse } from "next";

import { listScrubRulesAdmin, updateScrubRule } from "@/lib/db/mrli/scrub";

const SEVERITIES = ["error", "warning", "info"] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const rules = await listScrubRulesAdmin();

      return res.status(200).json({ success: true, rules });
    }

    if (req.method === "POST") {
      const body = (req.body ?? {}) as {
        code?: string;
        active?: boolean;
        severity?: string;
        description?: string;
        actor?: string;
      };
      const code = typeof body.code === "string" ? body.code.trim() : "";

      if (!code) {
        return res.status(400).json({ success: false, message: "กรุณาระบุ code ของกฎ" });
      }
      if (
        body.severity != null &&
        !SEVERITIES.includes(body.severity as (typeof SEVERITIES)[number])
      ) {
        return res.status(400).json({
          success: false,
          message: `ความรุนแรงไม่ถูกต้อง (ใช้ได้: ${SEVERITIES.join(", ")})`,
        });
      }

      const rule = await updateScrubRule({
        code,
        active: typeof body.active === "boolean" ? body.active : undefined,
        severity: body.severity as (typeof SEVERITIES)[number] | undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        actor:
          typeof body.actor === "string" && body.actor.trim() !== "" ? body.actor.trim() : null,
      });

      return res.status(200).json({ success: true, rule });
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[API] MRLI rules:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    return res.status(503).json({
      success: false,
      storeUnavailable: true,
      message:
        "MRLI store ยังไม่พร้อมใช้งาน — ตรวจสอบการตั้งค่า MySQL (DB_HOST/DB_USER/DB_PASSWORD/DB_NAME)",
      error: process.env.NODE_ENV !== "production" ? message : undefined,
    });
  }
}
