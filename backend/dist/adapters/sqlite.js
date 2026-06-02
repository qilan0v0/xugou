"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDb = createDb;
exports.getRawDb = getRawDb;
exports.closeDb = closeDb;
// SQLite adapter using sql.js (pure JS/WASM, zero native deps)
const sql_js_1 = __importDefault(require("sql.js"));
const fs_1 = require("fs");
const path_1 = require("path");
let db = null;
let dbPath;
class D1PreparedStatement {
    sql;
    params = [];
    constructor(sql) {
        this.sql = sql;
    }
    bind(...values) {
        // Convert undefined to null for SQLite
        this.params = values.map(v => v === undefined ? null : v);
        return this;
    }
    all() {
        try {
            const stmt = db.prepare(this.sql);
            stmt.bind(this.params);
            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();
            return { results: rows, success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    }
    first() {
        try {
            const stmt = db.prepare(this.sql);
            stmt.bind(this.params);
            if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return row;
            }
            stmt.free();
            return null;
        }
        catch (e) {
            console.error('[sqlite] first() error:', e.message, 'SQL:', this.sql);
            return null;
        }
    }
    run() {
        try {
            const stmt = db.prepare(this.sql);
            stmt.bind(this.params);
            stmt.step();
            stmt.free();
            if (dbPath)
                scheduleSave();
            return { success: true };
        }
        catch (e) {
            console.error('run error:', e.message);
            return { success: false, error: e.message };
        }
    }
    raw() {
        const result = this.all();
        return Promise.resolve(result.results || []);
    }
}
function saveDb() {
    if (db && dbPath) {
        try {
            const data = db.export();
            const buffer = Buffer.from(data);
            (0, fs_1.writeFileSync)(dbPath, buffer);
        }
        catch (e) {
            console.error('saveDb error:', e);
        }
    }
}
let saveTimer = null;
function scheduleSave() {
    if (saveTimer)
        return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        saveDb();
    }, 5000);
}
function flushSave() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    saveDb();
}
let SQL;
async function createDb(path) {
    dbPath = path || process.env.DB_PATH || './data/qltz.db';
    const dir = (0, path_1.dirname)(dbPath);
    if (!(0, fs_1.existsSync)(dir)) {
        (0, fs_1.mkdirSync)(dir, { recursive: true });
    }
    SQL = await (0, sql_js_1.default)();
    if ((0, fs_1.existsSync)(dbPath)) {
        const buffer = (0, fs_1.readFileSync)(dbPath);
        db = new SQL.Database(buffer);
    }
    else {
        db = new SQL.Database();
    }
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    db.run('PRAGMA cache_size = -4000'); // 4MB page cache max
    db.run('PRAGMA optimize'); // compact on startup
    saveDb();
    return {
        prepare(sql) {
            return new D1PreparedStatement(sql);
        },
        exec(sql) {
            try {
                db.run(sql);
                scheduleSave();
                return { success: true };
            }
            catch (e) {
                return { success: false, error: e.message };
            }
        },
        async batch(statements) {
            const results = [];
            try {
                db.run('BEGIN TRANSACTION');
                for (const stmt of statements) {
                    results.push(stmt.run());
                }
                db.run('COMMIT');
            }
            catch (e) {
                db.run('ROLLBACK');
                results.push({ success: false, error: e.message });
            }
            saveDb();
            return results;
        },
    };
}
function getRawDb() {
    return db;
}
function closeDb() {
    if (db) {
        saveDb();
        db.close();
        db = null;
    }
}
