"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const logger_1 = require("hono/logger");
const cors_1 = require("hono/cors");
const pretty_json_1 = require("hono/pretty-json");
const initCheck_1 = require("./setup/initCheck");
const jwt_1 = require("./utils/jwt");
// 导入路由
const ratelimit_1 = require("./utils/ratelimit");
const auth_1 = __importDefault(require("./routes/auth"));
const monitors_1 = __importDefault(require("./routes/monitors"));
const agents_1 = __importDefault(require("./routes/agents"));
const users_1 = __importDefault(require("./routes/users"));
const status_1 = __importDefault(require("./routes/status"));
const database_1 = __importDefault(require("./setup/database"));
const tasks_1 = require("./tasks");
// 创建Hono应用
const app = new hono_1.Hono();
// 中间件，需要作为服务端接收所有来源客户端的请求
app.use('*', (0, logger_1.logger)());
app.use('*', (0, cors_1.cors)({
    origin: (origin) => {
        const allowed = ['xugou-frontend.pages.dev', 'xugou.mdzz.uk', 'localhost', '127.0.0.1'];
        if (!origin || allowed.some(d => origin.includes(d)))
            return origin;
        return 'https://xugou-frontend.pages.dev';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
}));
app.use('*', (0, pretty_json_1.prettyJSON)());
// 在 Workers 环境中，您可能需要设置这些响应头
app.use('*', async (c, next) => {
    await next();
    c.header('Access-Control-Allow-Origin', c.req.header('origin') || '*');
    c.header('Access-Control-Allow-Credentials', 'true');
});
// 公共路由
app.get('/', (c) => c.json({ message: 'XUGOU API 服务正在运行' }));
// 获取 JWT 密钥
const getJwtSecret = (c) => {
    // 在 Cloudflare Workers 环境中，使用 env 变量
    if (typeof process === 'undefined') {
        return c.env.JWT_SECRET || 'your-secret-key-change-in-production';
    }
    // 在 Node.js 环境中，使用 process.env
    return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
};
// 直接处理 agent status 上报 (在子路由之前匹配，确保优先处理)
app.post('/api/agents/status', async (c) => {
    try {
        const raw = await c.req.text();
        const body = JSON.parse(raw);
        const token = body.token;
        const cpu = body.cpu_usage ?? body.cpu?.usage ?? null;
        const memTotal = body.memory_total ?? body.memory?.total ?? null;
        const memUsed = body.memory_used ?? body.memory?.used ?? null;
        let diskTotal = body.disk_total;
        let diskUsed = body.disk_used;
        if ((diskTotal == null) && Array.isArray(body.disks)) {
            diskTotal = body.disks.reduce((s, d) => s + (d.total || 0), 0);
            diskUsed = body.disks.reduce((s, d) => s + (d.used || 0), 0);
        }
        let netRx = body.network_rx;
        let netTx = body.network_tx;
        if ((netRx == null) && Array.isArray(body.network)) {
            netRx = body.network.reduce((s, n) => s + (n.bytes_recv || 0), 0);
            netTx = body.network.reduce((s, n) => s + (n.bytes_sent || 0), 0);
        }
        // New system info fields from nested SystemInfo JSON
        const cpuArch = (0, jwt_1.toD1Primitive)(body.cpu_arch ?? body.cpu?.arch ?? null);
        const cpuModelName = (0, jwt_1.toD1Primitive)(body.cpu_model_name ?? body.cpu?.model_name ?? null);
        const cpuCores = body.cpu_cores ?? body.cpu?.cores ?? null;
        const l1 = body.load1 ?? body.load?.load1 ?? null;
        const l5 = body.load5 ?? body.load?.load5 ?? null;
        const l15 = body.load15 ?? body.load?.load15 ?? null;
        const bt = (0, jwt_1.toD1Primitive)(body.boot_time ?? null);
        const av = (0, jwt_1.toD1Primitive)(body.agent_version ?? null);
        let netRxTotal = body.network_rx_total;
        let netTxTotal = body.network_tx_total;
        if ((netRxTotal == null) && Array.isArray(body.network)) {
            netRxTotal = body.network.reduce((s, n) => s + (n.bytes_recv || 0), 0);
            netTxTotal = body.network.reduce((s, n) => s + (n.bytes_sent || 0), 0);
        }
        if (!token)
            return c.json({ success: false, message: 'no token' }, 400);
        const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first();
        if (!agent)
            return c.json({ success: false, message: 'agent not found' }, 404);
        // 从 Cloudflare 请求元数据提取国家代码
        const country = c.req.raw?.cf?.country ?? null;
        // 首次连接/重连时刷新 connected_at
        const now = new Date().toISOString();
        const currentStatus = await c.env.DB.prepare('SELECT status FROM agents WHERE id = ?').bind(agent.id).first();
        const wasInactive = !currentStatus || currentStatus.status === 'inactive';
        if (wasInactive) {
            await c.env.DB.prepare('UPDATE agents SET connected_at = ? WHERE id = ?').bind(now, agent.id).run();
        }
        const result = await c.env.DB.prepare(`UPDATE agents SET status='active', cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, network_rx=?, network_tx=?, hostname=?, ip_address=?, os=?, version=?, cpu_arch=?, cpu_model_name=?, cpu_cores=?, load1=?, load5=?, load15=?, boot_time=?, network_rx_total=?, network_tx_total=?, agent_version=?, country=?, updated_at=?, last_payload=? WHERE id=?`).bind(cpu, memTotal, memUsed, diskTotal, diskUsed, netRx, netTx, (0, jwt_1.toD1Primitive)(body.hostname), (0, jwt_1.toD1Primitive)(body.ip_address ?? (Array.isArray(body.ip_addresses) ? body.ip_addresses[0] : null) ?? (Array.isArray(body.ip) ? body.ip[0] : body.ip) ?? body.IP), (0, jwt_1.toD1Primitive)(body.os), (0, jwt_1.toD1Primitive)(body.version), cpuArch, cpuModelName, cpuCores, l1, l5, l15, bt, netRxTotal, netTxTotal, av, country, now, raw.slice(0, 2000), agent.id).run();
        if (!result.success) {
            console.error('DIRECT_STATUS update failed:', result.error);
            return c.json({ success: false, message: 'update failed: ' + (result.error || 'unknown') }, 500);
        }
        return c.json({ success: true, message: 'ok' });
    }
    catch (e) {
        console.error('DIRECT_STATUS err:', e.message);
        return c.json({ success: false, message: e.message }, 500);
    }
});
// 限流: 登录/注册 每分钟最多10次
app.use('/api/auth/*', async (c, next) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    if (!(0, ratelimit_1.rateLimit)('auth:' + ip, 10, 60000)) {
        return c.json({ success: false, message: '请求过于频繁，请稍后再试' }, 429);
    }
    await next();
});
// 路由注册
app.route('/api/auth', auth_1.default);
app.route('/api/monitors', monitors_1.default);
app.route('/api/agents', agents_1.default);
app.route('/api/users', users_1.default);
app.route('/api/status', status_1.default);
app.route('/api', database_1.default);
// 添加监控检查触发路由
app.get('/api/trigger-check', async (c) => {
    const { scheduled } = tasks_1.monitorTask;
    if (scheduled) {
        await scheduled(null, c.env, null);
    }
    await (0, tasks_1.checkAgentsStatus)(c.env);
    return c.json({ success: true, message: '监控检查和客户端状态已触发' });
});
// 数据库状态标志，用于记录数据库初始化状态
let dbInitialized = false;
// 导出 fetch 函数供 Cloudflare Workers 使用
exports.default = {
    // 处理 HTTP 请求
    async fetch(request, env, ctx) {
        try {
            // 如果数据库尚未初始化，则进行初始化检查
            if (!dbInitialized) {
                console.log('首次请求，检查数据库状态...');
                try {
                    const initResult = await (0, initCheck_1.checkAndInitializeDatabase)(env);
                    dbInitialized = true;
                    console.log('数据库检查结果:', initResult.message);
                }
                catch (error) {
                    console.error('数据库初始化检查失败:', error);
                    // 即使初始化失败，也设置标志位以避免重复检查
                    dbInitialized = true;
                }
            }
            // 处理请求
            return app.fetch(request, env, ctx);
        }
        catch (error) {
            console.error('请求处理错误:', error);
            return new Response(JSON.stringify({ error: '服务器内部错误' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    },
    // 添加定时任务，每分钟执行一次监控检查和客户端状态检查
    async scheduled(event, env, ctx) {
        try {
            // 首先检查数据库状态
            if (!dbInitialized) {
                const initResult = await (0, initCheck_1.checkAndInitializeDatabase)(env);
                dbInitialized = true;
                console.log('数据库检查结果:', initResult.message);
            }
            // 执行所有定时任务
            await (0, tasks_1.runScheduledTasks)(event, env, ctx);
        }
        catch (error) {
            console.error('定时任务执行出错:', error);
        }
    }
};
//# sourceMappingURL=index.js.map