/**
 * GET /api/version
 * คืนค่าเวอร์ชันแอปและชื่อ (สำหรับ health check / monitoring)
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { appName, appVersion } from "@/lib/version";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  return res.status(200).json({
    success: true,
    data: {
      version: appVersion,
      name: appName,
    },
  });
}
