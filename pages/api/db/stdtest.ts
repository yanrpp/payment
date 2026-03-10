/**
 * API: ดึงข้อมูลจากตาราง stdtest (ฐานข้อมูลตาม DB_NAME ใน .env.local เช่น rpptest_db)
 * GET /api/db/stdtest
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/mysql";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const rows = await executeQuery<Record<string, unknown>>(
      "SELECT * FROM stdtest ORDER BY 1 LIMIT 100"
    );

    res.status(200).json({
      success: true,
      database: process.env.DB_NAME ?? "(ไม่ระบุ)",
      table: "stdtest",
      count: rows.length,
      data: rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      success: false,
      message: "ดึงข้อมูลตาราง stdtest ไม่สำเร็จ",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
