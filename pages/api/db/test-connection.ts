/**
 * API Route: ทดสอบการเชื่อมต่อ Oracle Database
 * GET /api/db/test-connection
 * ใช้สำหรับระบบต้นแบบ — ตรวจสอบการเชื่อมต่อและ pool stats
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { initializePool, getPoolStats, executeQuery } from "@/lib/db/connection";

interface OracleVersionRow {
  BANNER: string;
}

type Data = {
  success: boolean;
  message: string;
  poolStats?: { connectionsOpen: number; connectionsInUse: number };
  version?: string;
  error?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    await initializePool();
    const poolStats = getPoolStats();

    const result = await executeQuery<OracleVersionRow>(
      "SELECT BANNER FROM v$version WHERE ROWNUM = 1"
    );
    const version = result.rows[0]?.BANNER ?? "Unknown";

    res.status(200).json({
      success: true,
      message: "เชื่อมต่อ Oracle สำเร็จ",
      poolStats: poolStats ?? undefined,
      version,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      success: false,
      message: "เชื่อมต่อ Oracle ล้มเหลว",
      error: errorMessage,
    });
  }
}
