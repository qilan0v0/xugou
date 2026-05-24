// SQLite adapter using better-sqlite3 (native C, disk-based, not WASM)
import Database, { Statement as BStatement, RunResult } from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: { changes?: number };
}

class D1PreparedStatement {
  private stmt: BStatement;

  constructor(stmt: BStatement) {
    this.stmt = stmt;
  }

  bind(...values: any[]): this {
    this.stmt.raw(true);  // ensure params mode
    // params will be passed to all/get/run directly
    (this as any)._params = values.map(v => v === undefined ? null : v);
    return this;
  }

  all<T = unknown>(): D1Result<T> {
    try {
      const params = (this as any)._params || [];
      const rows = this.stmt.all(...params) as T[];
      return { results: rows, success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  first<T = unknown>(): T | null {
    try {
      const params = (this as any)._params || [];
      const row = this.stmt.get(...params) as T | undefined;
      return row ?? null;
    } catch (e: any) {
      console.error('[better-sqlite3] first() error:', e.message);
      return null;
    }
  }

  run<T = unknown>(): D1Result<T> {
    try {
      const params = (this as any)._params || [];
      const result: RunResult = this.stmt.run(...params);
      return { success: true, meta: { changes: result.changes } };
    } catch (e: any) {
      console.error('[better-sqlite3] run() error:', e.message);
      return { success: false, error: e.message };
    }
  }

  raw<T = unknown>(): Promise<T[]> {
    const result = this.all<T>();
    return Promise.resolve(result.results || []);
  }
}

export interface SqliteAdapter {
  prepare(sql: string): D1PreparedStatement;
  exec<T = unknown>(sql: string): D1Result<T>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

let db: Database.Database | null = null;

export function createDb(path?: string): SqliteAdapter {
  const dbPath = path || process.env.DB_PATH || './data/xugou.db';
  const dir = dirname(dbPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -4000');  // 4MB page cache max
  db.pragma('synchronous = NORMAL');

  return {
    prepare(sql: string) {
      return new D1PreparedStatement(db!.prepare(sql));
    },
    exec<T = unknown>(sql: string): D1Result<T> {
      try {
        db!.exec(sql);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      const txn = db!.transaction(() => {
        for (const stmt of statements) {
          results.push(stmt.run<T>());
        }
      });
      try {
        txn();
      } catch (e: any) {
        results.push({ success: false, error: e.message });
      }
      return results;
    },
  };
}

export function getRawDb(): Database.Database | null {
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
