// 通用数据库类型定义
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec<T = unknown>(query: string): D1Result<T>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): T | null;
  run<T = unknown>(): D1Result<T>;
  all<T = unknown>(): D1Result<T>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: object;
}

// 通用绑定类型
export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  ENABLE_DB_INIT?: string;
}; 