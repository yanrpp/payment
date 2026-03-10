/**
 * API: ดึงข้อมูลจากตาราง USERTYPE (Oracle)
 * GET /api/db/oracle-usertype
 * ใช้ schema ตาม ORACLE_SCHEMA ใน .env.local
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/connection";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const result = await executeQuery<Record<string, unknown>>(
      "SELECT * FROM USERTYPE WHERE ROWNUM <= 100"
    );

    const rows = result.rows ?? [];

    res.status(200).json({
      success: true,
      database: "Oracle",
      table: "USERTYPE",
      count: rows.length,
      data: rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      success: false,
      message: "ดึงข้อมูลตาราง USERTYPE ไม่สำเร็จ",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
