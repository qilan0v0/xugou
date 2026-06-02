"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDb = createDb;
exports.getRawDb = getRawDb;
exports.closeDb = closeDb;
// SQLite adapter using better-sqlite3 (native C, disk-based, not WASM)
// Uses dynamic require: if better-sqlite3 is not installed, import will throw (caught by caller)
const BetterSqlite3 = require('better-sqlite3');
const Database = BetterSqlite3.default || BetterSqlite3;
const { existsSync, mkdirSync } = require('fs');
const { dirname } = require('path');
class D1PreparedStatement {
    stmt;
    constructor(stmt) {
        this.stmt = stmt;
    }
    bind(...values) {
        this._params = values.map(v => {
            if (v === undefined)
                return null;
            if (typeof v === 'boolean')
                return v ? 1 : 0;
            if (v instanceof Date)
                return v.toISOString();
            return v;
        });
        return this;
    }
    all() {
        try {
            const params = this._params || [];
            const rows = this.stmt.all(...params);
            return { results: rows, success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    }
    first() {
        try {
            const params = this._params || [];
            const row = this.stmt.get(...params);
            return row ?? null;
        }
        catch (e) {
            console.error('[better-sqlite3] first() error:', e.message);
            return null;
        }
    }
    run() {
        try {
            const params = this._params || [];
            const result = this.stmt.run(...params);
            return { success: true, meta: { changes: result.changes } };
        }
        catch (e) {
            console.error('[better-sqlite3] run() error:', e.message);
            return { success: false, error: e.message };
        }
    }
    raw() {
        const result = this.all();
        return Promise.resolve(result.results || []);
    }
}
let db = null;
function createDb(path) {
    const dbPath = path || process.env.DB_PATH || './data/qltz.db';
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('cache_size = -4000');
    db.pragma('synchronous = NORMAL');
    return {
        prepare(sql) {
            return new D1PreparedStatement(db.prepare(sql));
        },
        exec(sql) {
            try {
                db.exec(sql);
                return { success: true };
            }
            catch (e) {
                return { success: false, error: e.message };
            }
        },
        async batch(statements) {
            const results = [];
            const txn = db.transaction(() => {
                for (const stmt of statements) {
                    results.push(stmt.run());
                }
            });
            try {
                txn();
            }
            catch (e) {
                results.push({ success: false, error: e.message });
            }
            return results;
        },
    };
}
function getRawDb() {
    return db;
}
function closeDb() {
    if (db) {
        db.close();
        db = null;
    }
}
