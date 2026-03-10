/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  serviceName?: string;
  sid?: string;
  user: string;
  password: string;
  schema?: string;
  poolMin?: number;
  poolMax?: number;
  poolIncrement?: number;
}

/**
 * Connection pool configuration
 */
export interface PoolConfig {
  user: string;
  password: string;
  connectString: string;
  poolMin: number;
  poolMax: number;
  poolIncrement: number;
  poolTimeout: number;
  queueTimeout: number;
}

/**
 * Connection options for executing queries
 */
export interface ConnectionOptions {
  autoCommit?: boolean;
  outFormat?: "ARRAY" | "OBJECT";
}

/**
 * Query metadata
 */
export interface QueryMetaData {
  name?: string;
  fetchType?: number;
  dbType?: number;
  dbTypeName?: string;
  nullable?: boolean;
  precision?: number;
  scale?: number;
}

/**
 * Query result wrapper
 */
export interface QueryResult<T = unknown> {
  rows: T[];
  metaData?: QueryMetaData[];
  rowsAffected?: number;
}

/**
 * Query parameters
 */
export type QueryParams = unknown[] | Record<string, unknown>;

/**
 * Database error with additional context
 */
export interface DatabaseError extends Error {
  code?: string;
  errorNum?: number;
  offset?: number;
}
