// SQLite adapter using sql.js (pure JS/WASM, zero native deps)
import initSqlJs, { Database as SqlJsDb, Statement, SqlJsStatic, BindParams } from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { dirname } from 'path';

let db: SqlJsDb | null = null;
let dbPath: string;

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: object;
}

class D1PreparedStatement {
  private sql: string;
  private params: BindParams = [];

  constructor(sql: string) {
    this.sql = sql;
  }

  bind(...values: any[]): this {
    // Convert undefined to null for SQLite
    this.params = values.map(v => v === undefined ? null : v);
    return this;
  }

  all<T = unknown>(): D1Result<T> {
    try {
      const stmt = db!.prepare(this.sql);
      stmt.bind(this.params);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return { results: rows, success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  first<T = unknown>(): T | null {
    try {
      const stmt = db!.prepare(this.sql);
      stmt.bind(this.params);
      if (stmt.step()) {
        const row = stmt.getAsObject() as T;
        stmt.free();
        return row;
      }
      stmt.free();
      return null;
    } catch {
      return null;
    }
  }

  run<T = unknown>(): D1Result<T> {
    try {
      const stmt = db!.prepare(this.sql);
      stmt.bind(this.params);
      console.log('run: sql=', this.sql.slice(0, 100), 'params=', JSON.stringify(this.params.slice(0, 5)));
      stmt.step();
      stmt.free();
      if (dbPath) saveDb();
      return { success: true };
    } catch (e: any) {
      console.error('run error:', e.message, 'sql:', this.sql.slice(0, 100));
      return { success: false, error: e.message };
    }
  }

  raw<T = unknown>(): Promise<T[]> {
    const result = this.all<T>();
    return Promise.resolve(result.results || []);
  }
}

function saveDb() {
  if (db && dbPath) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      writeFileSync(dbPath, buffer);
      if (existsSync(dbPath)) {
        const stats = statSync(dbPath);
        console.log('saveDb: wrote', stats.size, 'bytes to', dbPath);
      }
    } catch (e) {
      console.error('saveDb error:', e);
    }
  }
}

// Match D1Database interface
interface SqliteAdapter {
  prepare(sql: string): D1PreparedStatement;
  exec<T = unknown>(sql: string): D1Result<T>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

let SQL: SqlJsStatic;

export async function createDb(path?: string): Promise<SqliteAdapter> {
  dbPath = path || process.env.DB_PATH || './data/xugou.db';
  const dir = dirname(dbPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  saveDb();

  return {
    prepare(sql: string) {
      return new D1PreparedStatement(sql);
    },
    exec<T = unknown>(sql: string): D1Result<T> {
      try {
        console.log('DEBUG run sql:', sql.slice(0, 200)); db!.run(sql); console.log('DEBUG run done');
        saveDb();
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      const results: D1Result<T>[] = [];
      try {
        db!.run('BEGIN TRANSACTION');
        for (const stmt of statements) {
          results.push(stmt.run<T>());
        }
        db!.run('COMMIT');
      } catch (e: any) {
        db!.run('ROLLBACK');
        results.push({ success: false, error: e.message });
      }
      saveDb();
      return results;
    },
  };
}

export function getRawDb(): SqlJsDb | null {
  return db;
}

export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}
