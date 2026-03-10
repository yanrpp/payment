import type { ConnectionOptions, QueryResult } from "@/types/database";

import { platform } from "os";
import { resolve } from "path";

import oracledb from "oracledb";

import { getPoolConfig, getOracleSchema } from "@/config/database";
import { escapeIdentifier } from "@/lib/db/utils";

// Initialize dotenv to load environment variables
if (typeof window === "undefined") {
  // Only load dotenv on server-side
  import("dotenv/config").catch(() => {
    // Ignore errors if dotenv is not available
  });
}

let pool: oracledb.Pool | null = null;
let isThickModeInitialized = false;

/**
 * Get Oracle Instant Client library path based on platform
 * Priority: 1. Environment variable, 2. Project folder based on platform
 */
function getOracleClientLibPath(): string {
  // 1. Check environment variable first
  if (process.env.ORACLE_CLIENT_LIB_PATH) {
    return process.env.ORACLE_CLIENT_LIB_PATH;
  }

  // 2. Determine platform-specific path
  const currentPlatform = platform();
  let platformFolder: string;

  switch (currentPlatform) {
    case "win32":
      // Windows 64-bit (most common)
      platformFolder = "win64";
      break;
    case "darwin":
      // macOS - check architecture
      // For Apple Silicon (arm64) or Intel (x64)
      platformFolder = "mac";
      break;
    case "linux":
      // Linux - typically x64
      platformFolder = "linux";
      break;
    default:
      // Default to win64 for Windows if platform is unknown
      platformFolder = "win64";
      break;
  }

  const projectPath = resolve(process.cwd(), "InstantClient", platformFolder);

  return projectPath;
}

/**
 * Initialize Oracle Thick Mode
 * Required for Oracle 11g and earlier versions
 */
async function initializeThickMode(): Promise<void> {
  if (isThickModeInitialized) {
    return;
  }

  if (!oracledb.initOracleClient) {
    throw new Error(
      "initOracleClient is not available. Please ensure you are using a compatible version of node-oracledb."
    );
  }

  // Get library path
  const clientLibPath = getOracleClientLibPath();

  try {
    await oracledb.initOracleClient({ libDir: clientLibPath });
    isThickModeInitialized = true;
  } catch (thickError: unknown) {
    const errorMessage = thickError instanceof Error ? thickError.message : String(thickError);

    // Check for common errors
    let errorDetails = `Failed to initialize Oracle Thick mode with library path: ${clientLibPath}\n\n`;

    if (errorMessage.includes("DPI-1047")) {
      const currentPlatform = platform();
      const architectureHint =
        currentPlatform === "win32"
          ? "x64 for Windows 64-bit"
          : currentPlatform === "darwin"
            ? "arm64 for Apple Silicon or x86_64 for Intel"
            : "x86_64 for Linux";

      errorDetails +=
        "Error DPI-1047: Architecture mismatch or library not found.\n" +
        "Please verify:\n" +
        "1. The library path is correct\n" +
        `2. The Oracle Instant Client architecture matches your system (${architectureHint})\n` +
        "3. All required library files are present in the directory\n\n";
    } else if (errorMessage.includes("NJS-500")) {
      errorDetails +=
        "Error NJS-500: Oracle Instant Client libraries not found.\n" +
        "Please verify the library path is correct and contains libclntsh.dylib\n\n";
    }

    errorDetails += `Full error: ${errorMessage}\n\n`;
    errorDetails += "See: https://oracle.github.io/node-oracledb/INSTALL.html#instinst";

    throw new Error(errorDetails);
  }
}

/**
 * Initialize Oracle connection pool
 */
export async function initializePool(): Promise<void> {
  if (pool) {
    return;
  }

  try {
    // Initialize Thick mode first (required for Oracle 11g)
    await initializeThickMode();

    const poolConfig = getPoolConfig();

    // Set Oracle client output format
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

    pool = await oracledb.createPool({
      user: poolConfig.user,
      password: poolConfig.password,
      connectString: poolConfig.connectString,
      poolMin: poolConfig.poolMin,
      poolMax: poolConfig.poolMax,
      poolIncrement: poolConfig.poolIncrement,
      poolTimeout: poolConfig.poolTimeout,
      queueTimeout: poolConfig.queueTimeout,
    });

    // Connection pool initialized successfully
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize Oracle connection pool:", error);
    throw error;
  }
}

/**
 * Get connection from pool and set default schema if configured
 */
export async function getConnection(): Promise<oracledb.Connection> {
  if (!pool) {
    await initializePool();
  }

  if (!pool) {
    throw new Error("Connection pool is not initialized");
  }

  try {
    const connection = await pool.getConnection();

    // Set default schema from ORACLE_SCHEMA environment variable
    const schema = getOracleSchema();

    if (schema) {
      try {
        const escapedSchema = escapeIdentifier(schema);

        await connection.execute(
          `ALTER SESSION SET CURRENT_SCHEMA = ${escapedSchema}`,
          {},
          { autoCommit: true }
        );
      } catch (schemaError) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to set CURRENT_SCHEMA to ${schema}:`, schemaError);
        // Continue even if schema setting fails
      }
    }

    return connection;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to get connection from pool:", error);
    throw error;
  }
}

/**
 * Release connection back to pool
 */
export async function releaseConnection(connection: oracledb.Connection): Promise<void> {
  try {
    await connection.close();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to release connection:", error);
    throw error;
  }
}

/**
 * Execute SQL query with automatic connection management
 */
export async function executeQuery<T = unknown>(
  sql: string,
  params?: unknown[] | Record<string, unknown>,
  options?: ConnectionOptions
): Promise<QueryResult<T>> {
  const connection = await getConnection();

  try {
    const result = await connection.execute(sql, params || {}, {
      autoCommit: options?.autoCommit ?? false,
      outFormat:
        options?.outFormat === "ARRAY" ? oracledb.OUT_FORMAT_ARRAY : oracledb.OUT_FORMAT_OBJECT,
    });

    if (options?.autoCommit) {
      await connection.commit();
    }

    return {
      rows: (result.rows || []) as T[],
      metaData: result.metaData,
      rowsAffected: result.rowsAffected,
    };
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // eslint-disable-next-line no-console
        console.error("Failed to rollback transaction:", rollbackError);
      }
    }
    // eslint-disable-next-line no-console
    console.error("Query execution failed:", error);
    throw error;
  } finally {
    await releaseConnection(connection);
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function executeTransaction<T = unknown>(
  queries: Array<{
    sql: string;
    params?: unknown[] | Record<string, unknown>;
  }>
): Promise<QueryResult<T>[]> {
  const connection = await getConnection();

  try {
    const results: QueryResult<T>[] = [];

    for (const query of queries) {
      const result = await connection.execute(query.sql, query.params || {}, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });

      results.push({
        rows: (result.rows || []) as T[],
        metaData: result.metaData,
        rowsAffected: result.rowsAffected,
      });
    }

    await connection.commit();

    return results;
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        // eslint-disable-next-line no-console
        console.error("Failed to rollback transaction:", rollbackError);
      }
    }
    // eslint-disable-next-line no-console
    console.error("Transaction execution failed:", error);
    throw error;
  } finally {
    await releaseConnection(connection);
  }
}

/**
 * Close connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.close(10); // Wait up to 10 seconds for connections to close
      pool = null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to close connection pool:", error);
      throw error;
    }
  }
}

/**
 * Get pool statistics
 */
export function getPoolStats(): {
  connectionsOpen: number;
  connectionsInUse: number;
} | null {
  if (!pool) {
    return null;
  }

  return {
    connectionsOpen: pool.connectionsOpen,
    connectionsInUse: pool.connectionsInUse,
  };
}
