/**
 * MySQL Connection Utility — ระบบต้นแบบ
 * รองรับ MySQL / MariaDB / phpMyAdmin
 */

import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

/**
 * สร้าง MySQL Connection Pool
 */
export function initializeMySQLPool(): mysql.Pool {
  if (pool) {
    return pool;
  }

  // ตรวจสอบว่ามี environment variables ครบหรือไม่
  if (
    !process.env.DB_HOST ||
    !process.env.DB_USER ||
    !process.env.DB_PASSWORD ||
    !process.env.DB_NAME
  ) {
    throw new Error(
      "กรุณาตั้งค่า Environment Variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME ในไฟล์ .env.local"
    );
  }

  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    charset: "utf8mb4",
  };

  pool = mysql.createPool(config);

  return pool;
}

/**
 * ดึง Connection Pool (auto-initialize ถ้ายังไม่มี)
 */
export function getMySQLPool(): mysql.Pool {
  if (!pool) {
    return initializeMySQLPool();
  }

  return pool;
}

/**
 * Execute Query (SELECT)
 * หมายเหตุ: ใช้ any[] สำหรับ params เพื่อให้เข้ากับ ExecuteValues ของ mysql2/promise
 */
export async function executeQuery<T = unknown>(sql: string, params?: any[]): Promise<T[]> {
  const poolInstance = getMySQLPool();
  const [rows] = await poolInstance.execute(sql, params ?? []);

  return rows as T[];
}

/**
 * Execute Query (INSERT/UPDATE/DELETE) - return affected rows
 */
export async function executeUpdate(
  sql: string,
  params?: any[]
): Promise<{ affectedRows: number; insertId?: number }> {
  const poolInstance = getMySQLPool();
  const [result] = await poolInstance.execute(sql, params ?? []);
  const mysqlResult = result as mysql.ResultSetHeader;

  return {
    affectedRows: mysqlResult.affectedRows,
    insertId: mysqlResult.insertId,
  };
}

/**
 * Execute Transaction (multiple queries)
 */
export async function executeTransaction<T = unknown>(
  queries: Array<{ sql: string; params?: any[] }>
): Promise<T[]> {
  const poolInstance = getMySQLPool();
  const connection = await poolInstance.getConnection();

  try {
    await connection.beginTransaction();
    const results: T[] = [];

    for (const query of queries) {
      const [result] = await connection.execute(query.sql, (query.params ?? []) as any[]);

      results.push(result as T);
    }

    await connection.commit();

    return results;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * ปิด Connection Pool
 */
export async function closeMySQLPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
