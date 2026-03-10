import type { QueryParams } from "@/types/database";

import { getOracleSchema } from "@/config/database";

/**
 * Sanitize SQL input to prevent SQL injection
 * Note: This is a basic sanitization. Always use parameterized queries.
 */
export function sanitizeSqlInput(input: string): string {
  // Remove potentially dangerous SQL characters
  return input.replace(/['";\\]/g, "");
}

/**
 * Format Oracle date to JavaScript Date
 */
export function formatOracleDate(oracleDate: Date | string | null | undefined): Date | null {
  if (!oracleDate) {
    return null;
  }

  if (oracleDate instanceof Date) {
    return oracleDate;
  }

  if (typeof oracleDate === "string") {
    return new Date(oracleDate);
  }

  return null;
}

/**
 * Format Oracle number to JavaScript number
 */
export function formatOracleNumber(
  oracleNumber: number | string | null | undefined
): number | null {
  if (oracleNumber === null || oracleNumber === undefined) {
    return null;
  }

  if (typeof oracleNumber === "number") {
    return oracleNumber;
  }

  if (typeof oracleNumber === "string") {
    const parsed = parseFloat(oracleNumber);

    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Convert Oracle CLOB to string
 */
export function formatOracleClob(clob: unknown): string | null {
  if (!clob) {
    return null;
  }

  if (typeof clob === "string") {
    return clob;
  }

  if (typeof clob === "object" && clob !== null && "toString" in clob) {
    return clob.toString();
  }

  return String(clob);
}

/**
 * Build WHERE clause from object
 * Useful for dynamic query building
 */
export function buildWhereClause(
  conditions: Record<string, unknown>,
  operator: "AND" | "OR" = "AND"
): { clause: string; params: unknown[] } {
  const keys = Object.keys(conditions).filter(
    (key) => conditions[key] !== undefined && conditions[key] !== null
  );

  if (keys.length === 0) {
    return { clause: "", params: [] };
  }

  const clauses = keys.map((key, index) => `${key} = :${index + 1}`);
  const params = keys.map((key) => conditions[key]);

  return {
    clause: `WHERE ${clauses.join(` ${operator} `)}`,
    params,
  };
}

/**
 * Build SET clause for UPDATE statements
 */
export function buildSetClause(updates: Record<string, unknown>): {
  clause: string;
  params: unknown[];
} {
  const keys = Object.keys(updates).filter(
    (key) => updates[key] !== undefined && updates[key] !== null
  );

  if (keys.length === 0) {
    throw new Error("No valid fields to update");
  }

  const clauses = keys.map((key, index) => `${key} = :${index + 1}`);
  const params = keys.map((key) => updates[key]);

  return {
    clause: `SET ${clauses.join(", ")}`,
    params,
  };
}

/**
 * Build INSERT values clause
 */
export function buildInsertClause(data: Record<string, unknown>): {
  columns: string;
  placeholders: string;
  params: unknown[];
} {
  const keys = Object.keys(data).filter((key) => data[key] !== undefined && data[key] !== null);

  if (keys.length === 0) {
    throw new Error("No valid fields to insert");
  }

  const columns = keys.join(", ");
  const placeholders = keys.map((_, index) => `:${index + 1}`).join(", ");
  const params = keys.map((key) => data[key]);

  return {
    columns,
    placeholders,
    params,
  };
}

/**
 * Escape table/column names (basic implementation)
 */
export function escapeIdentifier(identifier: string): string {
  // Remove any characters that could be used for SQL injection
  return identifier.replace(/[^a-zA-Z0-9_]/g, "");
}

/**
 * Get Oracle schema prefix from environment variable
 * Returns empty string if schema is not configured
 */
export function getSchemaPrefix(): string {
  const schema = getOracleSchema();

  if (!schema) {
    return "";
  }

  return escapeIdentifier(schema);
}

/**
 * Qualify table name with schema prefix if schema is configured
 * Example: "CLINICLCT" -> "rpp.CLINICLCT" (if ORACLE_SCHEMA=rpp)
 * Example: "CLINICLCT" -> "CLINICLCT" (if ORACLE_SCHEMA is not set)
 */
export function qualifyTableName(tableName: string): string {
  const schemaPrefix = getSchemaPrefix();
  const escapedTable = escapeIdentifier(tableName);

  if (!schemaPrefix) {
    return escapedTable;
  }

  return `${schemaPrefix}.${escapedTable}`;
}

/**
 * Format query parameters for logging (without sensitive data)
 */
export function formatQueryForLogging(sql: string, params?: QueryParams): string {
  if (!params) {
    return sql;
  }

  let formattedSql = sql;

  if (Array.isArray(params)) {
    params.forEach((param, index) => {
      const placeholder = `:${index + 1}`;
      const value = typeof param === "string" ? `'${param}'` : String(param);

      formattedSql = formattedSql.replace(placeholder, value);
    });
  } else if (typeof params === "object") {
    Object.entries(params).forEach(([key, value]) => {
      const placeholder = `:${key}`;
      const safeValue = typeof value === "string" ? `'${value}'` : String(value);

      formattedSql = formattedSql.replace(placeholder, safeValue);
    });
  }

  return formattedSql;
}
