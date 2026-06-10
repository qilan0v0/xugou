"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const logger_1 = require("hono/logger");
const cors_1 = require("hono/cors");
const pretty_json_1 = require("hono/pretty-json");
const auth_1 = __importDefault(require("./routes/auth"));
const monitors_1 = __importDefault(require("./routes/monitors"));
const agents_1 = __importDefault(require("./routes/agents"));
const users_1 = __importDefault(require("./routes/users"));
const status_1 = __importDefault(require("./routes/status"));
const database_1 = __importDefault(require("./setup/database"));
const tasks_1 = require("./tasks");
const jwt_1 = require("./utils/jwt");
// GeoIP cache (module-level, max 500 entries to limit memory)
const countryCache = new Map();
const MAX_CACHE_SIZE = 500;
const app = new hono_1.Hono();
const fs_1 = require("fs");
const configPath = process.env.CONFIG_PATH || './config.json';
let config = { port: 7860, hostname: '0.0.0.0', jwt_secret: 'change-me', enable_db_init: true, db_path: './data/qltz.db' };
if ((0, fs_1.existsSync)(configPath)) {
    try {
        config = { ...config, ...JSON.parse((0, fs_1.readFileSync)(configPath, 'utf-8')) };
    }
    catch (e) { }
}
let createDb, closeDb;
try {
    const m = require('./adapters/better-sqlite3');
    createDb = m.createDb;
    closeDb = m.closeDb;
    console.log('[DB] better-sqlite3 (native, disk-based)');
}
catch (e) {
    const m = require('./adapters/sqlite');
    createDb = m.createDb;
    closeDb = m.closeDb;
    console.log('[DB] sql.js (WASM fallback) — pkg install python3 gmake gcc for native');
}
const db = createDb(config.db_path);
const env = {
    DB: db,
    JWT_SECRET: config.jwt_secret || 'change-me',
    ENABLE_DB_INIT: config.enable_db_init ? 'true' : 'false',
};
const initCheck_1 = require("./setup/initCheck");
app.use('*', (0, logger_1.logger)());
app.use('*', (0, cors_1.cors)({
    origin: (origin) => {
        const allowed = ['qltz-frontend.pages.dev', 'qltz.mdzz.uk', 'localhost', '127.0.0.1', 'qilan.sbs', 'serv00.net'];
        if (!origin || allowed.some(d => origin.includes(d)))
            return origin;
        return 'https://qltz-frontend.pages.dev';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
    maxAge: 86400,
}));
app.use('*', (0, pretty_json_1.prettyJSON)());
app.use('*', async (c, next) => {
    c.env = env;
    await next();
});
app.get('/', (c) => c.json({ message: 'QLTZ API (Node.js)' }));
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
        // Calculate network totals from cumulative bytes
        let netRxTotal = body.network_rx_total;
        let netTxTotal = body.network_tx_total;
        if ((netRxTotal == null) && Array.isArray(body.network)) {
            netRxTotal = body.network.reduce((s, n) => s + (n.bytes_recv || 0), 0);
            netTxTotal = body.network.reduce((s, n) => s + (n.bytes_sent || 0), 0);
        }
        let netRx = body.network_rx;
        let netTx = body.network_tx;
        const cpuArch = (0, jwt_1.toD1Primitive)(body.cpu_arch ?? body.cpu?.arch ?? null);
        const cpuModelName = (0, jwt_1.toD1Primitive)(body.cpu_model_name ?? body.cpu?.model_name ?? null);
        const cpuCores = body.cpu_cores ?? body.cpu?.cores ?? null;
        const l1 = body.load1 ?? body.load?.load1 ?? null;
        const l5 = body.load5 ?? body.load?.load5 ?? null;
        const l15 = body.load15 ?? body.load?.load15 ?? null;
        const bt = (0, jwt_1.toD1Primitive)(body.boot_time ?? null);
        const av = (0, jwt_1.toD1Primitive)(body.agent_version ?? null);
        if (!token)
            return c.json({ success: false, message: 'no token' }, 400);
        // Look up country from client IP (before agent auto-create)
        const forwarded = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '';
        const clientIp = forwarded.split(',')[0]?.trim();
        let country = null;
        if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
            if (countryCache.has(clientIp)) {
                country = countryCache.get(clientIp);
            }
            else {
                try {
                    const res = await fetch('http://ip-api.com/json/' + clientIp + '?fields=countryCode');
                    if (res.ok) {
                        const data = await res.json();
                        country = data?.countryCode || null;
                        if (country) {
                            if (countryCache.size >= MAX_CACHE_SIZE) {
                                // evict oldest entry (Map preserves insertion order)
                                const firstKey = countryCache.keys().next().value;
                                if (firstKey)
                                    countryCache.delete(firstKey);
                            }
                            countryCache.set(clientIp, country);
                        }
                    }
                }
                catch (e) { /* ignore */ }
            }
        }
        let isNewAgent = false;
        let agent = await env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first();
        if (!agent) {
            const adminUser = env.DB.prepare('SELECT id FROM users WHERE role = ?').bind('admin').first();
            if (!adminUser)
                return c.json({ success: false, message: 'no admin user' }, 500);
            const autoName = (0, jwt_1.generateAgentName)(country);
            const now2 = new Date().toISOString();
            env.DB.prepare(`INSERT INTO agents (name, token, created_by, status, created_at, updated_at, connected_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`).bind(autoName, token, adminUser.id, now2, now2, now2).run();
            agent = env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first();
            if (!agent)
                return c.json({ success: false, message: 'auto-create failed' }, 500);
            isNewAgent = true;
        }
        // Recalc network rate from cumulative byte delta if agent reports 0
        if ((netRx == null || netRx === 0) && netRxTotal != null) {
            const prev = env.DB.prepare('SELECT network_rx_total, network_tx_total, updated_at FROM agents WHERE id = ?').bind(agent.id).first();
            if (prev && prev.network_rx_total != null) {
                const elapsed = (Date.now() - new Date(prev.updated_at).getTime()) / 1000;
                if (elapsed > 0 && elapsed < 3600) {
                    netRx = Math.max(0, (netRxTotal - (prev.network_rx_total || 0)) / elapsed / 1024);
                    netTx = Math.max(0, (netTxTotal - (prev.network_tx_total || 0)) / elapsed / 1024);
                }
            }
        }
        const now = new Date().toISOString();
        const prev = await env.DB.prepare('SELECT status, updated_at, connected_at, boot_time FROM agents WHERE id = ?').bind(agent.id).first();
        const currentStatus = prev?.status;
        // Detect reconnect: gap 2min~4min = real reconnection; >4min = likely backend restart, skip notification
        const gapMs = prev?.updated_at ? Date.now() - new Date(prev.updated_at).getTime() : 0;
        const wasDisconnected = gapMs > 120000 && gapMs < 240000;
        // wasInactive 仅用于上线通知判定（保持原行为，避免后端重启误报上线）
        const wasInactive = isNewAgent || (currentStatus === 'inactive') || (wasDisconnected && (!currentStatus || currentStatus !== 'active')) || (!currentStatus && !prev?.connected_at);
        // connected_at = 当前连接会话起点，取「上报时间」(now)，与系统开机时间无关。
        // 这样能真实反映断线重连：连接时长不会恒等于系统运行时长，也不会缺失。
        // 重置时机：缺失 / 之前被标记离线 / 上报中断过久(>4分钟，兜底后端宕机期间漏标的情况)。
        // 持续在线则保持不变，连接时长从首次连接持续累加。
        const connMissing = !prev?.connected_at;
        // 离线判定：之前被标记 inactive，或上报中断 >150 秒（>离线阈值2分钟，兜底标记未及时更新/后端宕机）
        const wasOffline = currentStatus === 'inactive' || (gapMs > 150000);
        if (isNewAgent || connMissing || wasOffline) {
            if (!isNewAgent) {
                console.log(`[连接] agent=${agent.id} 重置连接时长 (missing=${connMissing}, status=${currentStatus || '?'}, gap=${Math.round(gapMs / 1000)}s)`);
            }
            env.DB.prepare('UPDATE agents SET connected_at = ? WHERE id = ?').bind(now, agent.id).run();
        }
        const result = env.DB.prepare(`UPDATE agents SET status='active', cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, network_rx=?, network_tx=?, hostname=?, ip_address=?, os=?, version=?, cpu_arch=?, cpu_model_name=?, cpu_cores=?, load1=?, load5=?, load15=?, boot_time=?, network_rx_total=?, network_tx_total=?, agent_version=?, country=?, updated_at=?, last_payload=?, process_count=?, tcp_count=?, udp_count=? WHERE id=?`).bind(cpu, memTotal, memUsed, diskTotal, diskUsed, netRx, netTx, (0, jwt_1.toD1Primitive)(body.hostname), (0, jwt_1.toD1Primitive)(body.ip_address ?? (Array.isArray(body.ip_addresses) ? body.ip_addresses[0] : null) ?? (Array.isArray(body.ip) ? body.ip[0] : body.ip) ?? body.IP), (0, jwt_1.toD1Primitive)(body.os), (0, jwt_1.toD1Primitive)(body.version), cpuArch, cpuModelName, cpuCores, l1, l5, l15, bt, netRxTotal, netTxTotal, av, country, now, raw.slice(0, 2000), body.process_count ?? null, body.tcp_count ?? null, body.udp_count ?? null, agent.id).run();
        if (!result.success) {
            console.error('Status update failed:', result.error);
            return c.json({ success: false, message: 'update failed' }, 500);
        }
        // Insert metrics history record
        try {
            const memPctVal = (memTotal && memUsed) ? (memUsed / memTotal * 100) : null;
            const diskPctVal = (diskTotal && diskUsed) ? (diskUsed / diskTotal * 100) : null;
            env.DB.prepare('INSERT INTO agent_metrics_history (agent_id, timestamp, cpu, mem_pct, disk_pct, net_rx, net_tx, process_count, tcp_count, udp_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(agent.id, now, cpu, memPctVal, diskPctVal, netRx, netTx, body.process_count ?? null, body.tcp_count ?? null, body.udp_count ?? null).run();
            // Keep only the last 2880 records per agent (24h at 30s intervals)
            env.DB.prepare('DELETE FROM agent_metrics_history WHERE agent_id = ? AND id NOT IN (SELECT id FROM agent_metrics_history WHERE agent_id = ? ORDER BY id DESC LIMIT 2880)').bind(agent.id, agent.id).run();
        }
        catch (e) { /* non-critical */ }
        // 自动续期：已过期但在线的 agent 自动续期
        const agentForRenew = env.DB.prepare('SELECT expiry_time, duration_value, duration_unit FROM agents WHERE id = ?').bind(agent.id).first();
        if (agentForRenew?.expiry_time && agentForRenew?.duration_value && agentForRenew?.duration_unit) {
            if (new Date() > new Date(agentForRenew.expiry_time)) {
                const newExpiry = (0, jwt_1.addDuration)(new Date(), agentForRenew.duration_value, agentForRenew.duration_unit);
                env.DB.prepare('UPDATE agents SET start_time = ?, expiry_time = ? WHERE id = ?').bind(new Date().toISOString(), newExpiry.toISOString(), agent.id).run();
                console.log(`[续期] agent=${agent.id} 已过期，自动续期至 ${newExpiry.toISOString()}`);
            }
        }
        // 首次上线通知 (wasInactive → active)
        if (wasInactive) {
            const fullAgent = await env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agent.id).first();
            if (fullAgent) {
                console.log(`[上线] ${fullAgent.hostname || fullAgent.name || agent.id} 已上线 (IP: ${fullAgent.ip_address || '?'}, OS: ${fullAgent.os || '?'})`);
                (0, tasks_1.sendAgentNotification)(env, fullAgent, 'up').catch(e => console.error('[通知] 上线通知失败:', e.message));
            }
        }
        // Broadcast real-time update to connected WebSocket clients
        broadcast?.('agent-update', { id: agent.id });
        return c.json({ success: true, message: 'ok' });
    }
    catch (e) {
        console.error('Status err:', e.message);
        return c.json({ success: false, message: e.message }, 500);
    }
});
app.route('/api/auth', auth_1.default);
app.route('/api/monitors', monitors_1.default);
app.route('/api/agents', agents_1.default);
app.route('/api/users', users_1.default);
app.route('/api/status', status_1.default);
app.route('/api', database_1.default);
app.get('/api/trigger-check', async (c) => {
    await tasks_1.monitorTask.scheduled(null, env, {});
    await (0, tasks_1.checkAgentsStatus)(env);
    return c.json({ success: true, message: 'checks triggered' });
});
const node_server_1 = require("@hono/node-server");
const http_1 = require("http");
const port = parseInt(process.env.PORT || config.port || '7860');
const host = process.env.HOSTNAME || config.hostname || '0.0.0.0';
let broadcast = (type, data) => { };
// Throttled broadcast: collect pending agent IDs and flush at most once per second
const pendingBroadcasts = new Set();
let flushTimer = null;
const FLUSH_INTERVAL_MS = 1000;
function flushBroadcasts() {
    flushTimer = null;
    if (pendingBroadcasts.size === 0)
        return;
    const ids = Array.from(pendingBroadcasts);
    pendingBroadcasts.clear();
    const msg = `event: agent-update
data: ${JSON.stringify({ ids, time: new Date().toISOString() })}

`;
    for (const res of sseClients) {
        try {
            res.write(msg);
        }
        catch {
            sseClients.delete(res);
        }
    }
}
const listener = (0, node_server_1.getRequestListener)(app.fetch);
// SSE clients (ServerResponse objects kept open for streaming)
const sseClients = new Set();
const MAX_SSE_CLIENTS = 50;
// Heartbeat every 30s to detect dead connections
const HEARTBEAT_MS = 30000;
const heartbeat = setInterval(() => {
    for (const res of sseClients) {
        try {
            res.write('event: heartbeat\ndata: {}\n\n');
        }
        catch {
            sseClients.delete(res);
        }
    }
}, HEARTBEAT_MS);
const server = (0, http_1.createServer)((req, res) => {
    // SSE endpoint — works through any proxy, no special upgrade needed
    if (req.url === '/api/events' && req.method === 'GET') {
        if (sseClients.size >= MAX_SSE_CLIENTS) {
            res.writeHead(503, { 'Content-Type': 'text/plain' });
            res.end('Too many SSE connections');
            return;
        }
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': req.headers.origin || '*',
            'Access-Control-Allow-Credentials': 'true',
        });
        sseClients.add(res);
        res.write('event: connected\ndata: {}\n\n');
        console.log('SSE client connected, total:', sseClients.size);
        req.on('close', () => {
            sseClients.delete(res);
            console.log('SSE client disconnected, remaining:', sseClients.size);
        });
        return;
    }
    return listener(req, res);
});
// Override broadcast — queue agent IDs and flush throttled
broadcast = (type, data) => {
    if (data?.id) {
        pendingBroadcasts.add(data.id);
        if (!flushTimer) {
            flushTimer = setTimeout(flushBroadcasts, FLUSH_INTERVAL_MS);
        }
    }
};
(async () => {
    const initResult = await (0, initCheck_1.checkAndInitializeDatabase)(env);
    console.log('DB init:', initResult.message);
    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`Port ${port} busy, retrying in 3s...`);
            setTimeout(() => { server.close(); server.listen(port, host); }, 3000);
        }
        else {
            console.error('Server error:', e);
            process.exit(1);
        }
    });
    server.listen(port, host, () => {
        console.log(`Qltz Node.js backend on http://${host}:${port}`);
    });
})();
setInterval(async () => {
    try {
        await (0, tasks_1.runScheduledTasks)(null, env, {});
    }
    catch (e) {
        console.error('Scheduled task error:', e);
    }
}, 60 * 1000);
process.on('SIGINT', () => { clearInterval(heartbeat); closeDb(); process.exit(0); });
process.on('SIGTERM', () => { clearInterval(heartbeat); closeDb(); process.exit(0); });
