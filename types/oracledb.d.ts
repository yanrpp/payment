/**
 * Type declarations for oracledb module
 * This is a minimal type definition for basic usage
 */

declare module "oracledb" {
  export interface Connection {
    execute<T = unknown>(
      sql: string,
      params?: unknown[] | Record<string, unknown>,
      options?: ExecuteOptions
    ): Promise<ExecuteResult<T>>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    close(): Promise<void>;
  }

  export interface Pool {
    getConnection(): Promise<Connection>;
    close(closeOption?: number): Promise<void>;
    connectionsOpen: number;
    connectionsInUse: number;
  }

  export interface ExecuteOptions {
    autoCommit?: boolean;
    outFormat?: number;
  }

  export interface ExecuteResult<T = unknown> {
    rows?: T[];
    metaData?: Array<{
      name?: string;
      fetchType?: number;
      dbType?: number;
      dbTypeName?: string;
      nullable?: boolean;
      precision?: number;
      scale?: number;
    }>;
    rowsAffected?: number;
  }

  export interface PoolAttributes {
    user: string;
    password: string;
    connectString: string;
    poolMin?: number;
    poolMax?: number;
    poolIncrement?: number;
    poolTimeout?: number;
    queueTimeout?: number;
  }

  export const OUT_FORMAT_OBJECT: number;
  export const OUT_FORMAT_ARRAY: number;

  export let outFormat: number;

  export function createPool(poolAttributes: PoolAttributes): Promise<Pool>;

  export function initOracleClient(options?: { libDir?: string }): Promise<void> | void;
}
