"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const settingsRoutes = new hono_1.Hono();
// 获取所有设置（需管理员权限）
settingsRoutes.get('/', async (c) => {
    const auth = c.req.header('Authorization');
    if (!auth)
        return c.json({ success: false, message: 'unauthorized' }, 401);
    const token = auth.replace('Bearer ', '');
    try {
        const { verify } = require('jsonwebtoken');
        const decoded = verify(token, c.env.JWT_SECRET);
        if (decoded.role !== 'admin')
            return c.json({ success: false, message: 'forbidden' }, 403);
    }
    catch {
        return c.json({ success: false, message: 'invalid token' }, 401);
    }
    try {
        const result = await c.env.DB.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        if (result.results) {
            for (const row of result.results) {
                settings[row.key] = row.value;
            }
        }
        return c.json({ success: true, settings });
    }
    catch (e) {
        return c.json({ success: false, message: e.message }, 500);
    }
});
// 更新设置（需管理员权限）
settingsRoutes.put('/', async (c) => {
    const auth = c.req.header('Authorization');
    if (!auth)
        return c.json({ success: false, message: 'unauthorized' }, 401);
    const token = auth.replace('Bearer ', '');
    try {
        const { verify } = require('jsonwebtoken');
        const decoded = verify(token, c.env.JWT_SECRET);
        if (decoded.role !== 'admin')
            return c.json({ success: false, message: 'forbidden' }, 403);
    }
    catch {
        return c.json({ success: false, message: 'invalid token' }, 401);
    }
    try {
        const body = await c.req.json();
        const { settings } = body;
        if (!settings || typeof settings !== 'object') {
            return c.json({ success: false, message: 'settings object required' }, 400);
        }
        // 确保 settings 表存在
        try {
            await c.env.DB.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        }
        catch { }
        const stmt = c.env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        for (const [key, value] of Object.entries(settings)) {
            stmt.bind(key, String(value)).run();
        }
        return c.json({ success: true, message: 'settings updated' });
    }
    catch (e) {
        return c.json({ success: false, message: e.message }, 500);
    }
});
exports.default = settingsRoutes;
