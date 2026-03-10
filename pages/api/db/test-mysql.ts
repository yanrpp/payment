/**
 * API Route: ทดสอบการเชื่อมต่อ MySQL Database
 * GET /api/db/test-mysql
 * ใช้สำหรับระบบต้นแบบ — ตรวจสอบ version และรายชื่อตารางใน schema ปัจจุบัน
 */

import type { NextApiRequest, NextApiResponse } from "next";

import { executeQuery } from "@/lib/db/mysql";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const [result] = await executeQuery<{ version: string }>("SELECT VERSION() as version");
    const version = result?.version ?? "Unknown";

    const tables = await executeQuery<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       ORDER BY table_name`
    );

    res.status(200).json({
      success: true,
      message: "เชื่อมต่อ MySQL สำเร็จ",
      database: {
        version,
        name: process.env.DB_NAME ?? "(ไม่ระบุ)",
        host: process.env.DB_HOST ?? "localhost",
      },
      tables: {
        total: tables.length,
        list: tables.map((t) => t.table_name),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    res.status(500).json({
      success: false,
      message: "เชื่อมต่อ MySQL ล้มเหลว",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}
