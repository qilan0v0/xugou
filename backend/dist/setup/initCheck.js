"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
exports.checkAndInitializeDatabase = checkAndInitializeDatabase;
const database_1 = require("./database");
// 运行 D1 迁移（安全重复执行）
async function runMigrations(env) {
    const newColumns = [
        'cpu_arch TEXT',
        'cpu_model_name TEXT',
        'cpu_cores INTEGER',
        'load1 REAL',
        'load5 REAL',
        'load15 REAL',
        'boot_time TEXT',
        'network_rx_total INTEGER',
        'network_tx_total INTEGER',
        'agent_version TEXT',
        'country TEXT',
        'connected_at TEXT',
        'last_payload TEXT',
        'traffic_limit INTEGER',
        'expiry_time TEXT',
        'category TEXT',
    ];
    for (const col of newColumns) {
        try {
            await env.DB.exec(`ALTER TABLE agents ADD COLUMN ${col}`);
            console.log(`Migration: added column ${col}`);
        }
        catch (e) { /* column likely already exists, skip */ }
    }
}
// 检查并初始化数据库
async function checkAndInitializeDatabase(env) {
    try {
        console.log('检查数据库是否需要初始化...');
        // 检查用户表是否存在，如果不存在或为空则需要初始化
        let hasUsers = false;
        try {
            const userCount = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
            if (userCount && userCount.count > 0) {
                hasUsers = true;
            }
        }
        catch (error) {
            console.log('检查表出错，表可能不存在:', error);
        }
        if (hasUsers) {
            console.log('数据库已初始化，运行迁移...');
            await runMigrations(env);
            return { initialized: false, message: '数据库已经初始化，已运行迁移' };
        }
        // 新数据库：创建表、初始化
        console.log('开始初始化数据库...');
        await (0, database_1.createTables)(env);
        // 运行迁移（确保所有列都存在）
        await runMigrations(env);
        // 创建管理员用户（复用database.ts中的函数）
        await (0, database_1.createAdminUser)(env);
        // 添加示例数据（复用database.ts中的函数）
        await (0, database_1.addSampleMonitors)(env);
        await (0, database_1.addSampleAgents)(env);
        // 创建默认状态页配置（复用database.ts中的函数）
        await (0, database_1.createDefaultStatusPage)(env);
        return {
            initialized: true,
            message: '数据库初始化成功',
        };
    }
    catch (error) {
        console.error('数据库初始化检查错误:', error);
        throw error;
    }
}
//# sourceMappingURL=initCheck.js.map