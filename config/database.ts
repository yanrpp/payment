import type { DatabaseConfig, PoolConfig } from "@/types/database";

/**
 * Load environment variables and create database configuration
 */
function loadDatabaseConfig(): DatabaseConfig {
  const host = process.env.ORACLE_HOST || "localhost";
  const port = parseInt(process.env.ORACLE_PORT || "1521", 10);
  const serviceName = process.env.ORACLE_SERVICE_NAME;
  const sid = process.env.ORACLE_SID;
  const user = process.env.ORACLE_USER || "";
  const password = process.env.ORACLE_PASSWORD || "";
  const schema = process.env.ORACLE_SCHEMA;
  const poolMin = parseInt(process.env.ORACLE_POOL_MIN || "2", 10);
  const poolMax = parseInt(process.env.ORACLE_POOL_MAX || "10", 10);
  const poolIncrement = parseInt(process.env.ORACLE_POOL_INCREMENT || "1", 10);

  if (!user || !password) {
    throw new Error("ORACLE_USER and ORACLE_PASSWORD must be set in environment variables");
  }

  if (!serviceName && !sid) {
    throw new Error(
      "Either ORACLE_SERVICE_NAME or ORACLE_SID must be set in environment variables"
    );
  }

  return {
    host,
    port,
    serviceName,
    sid,
    user,
    password,
    schema,
    poolMin,
    poolMax,
    poolIncrement,
  };
}

/**
 * Create connection string for Oracle database
 */
function createConnectionString(config: DatabaseConfig): string {
  const { host, port, serviceName, sid } = config;

  if (serviceName) {
    return `${host}:${port}/${serviceName}`;
  }

  if (sid) {
    return `${host}:${port}:${sid}`;
  }

  throw new Error("Either serviceName or sid must be provided");
}

/**
 * Get database configuration
 */
export function getDatabaseConfig(): DatabaseConfig {
  return loadDatabaseConfig();
}

/**
 * Get pool configuration for Oracle connection pool
 */
export function getPoolConfig(): PoolConfig {
  const config = loadDatabaseConfig();
  const connectString = createConnectionString(config);

  return {
    user: config.user,
    password: config.password,
    connectString,
    poolMin: config.poolMin || 2,
    poolMax: config.poolMax || 10,
    poolIncrement: config.poolIncrement || 1,
    poolTimeout: 60, // seconds
    queueTimeout: 60000, // milliseconds
  };
}

/**
 * Get Oracle schema name from environment variable
 * Returns undefined if not set
 */
export function getOracleSchema(): string | undefined {
  return process.env.ORACLE_SCHEMA;
}
