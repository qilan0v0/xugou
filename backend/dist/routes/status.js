"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const jwt_1 = require("hono/jwt");
const jwt_2 = require("../utils/jwt");
const tasks_1 = require("../tasks");
// 创建 Hono 路由
const app = new hono_1.Hono();
// JWT auth middleware (applied per-route, not globally)
const requireAuth = async (c, next) => {
    try {
        const jwtMiddleware = (0, jwt_1.jwt)({ alg: "HS256", secret: (0, jwt_2.getJwtSecret)(c) });
        await jwtMiddleware(c, next);
        const payload = c.get('jwtPayload');
        if (!payload || !payload.id) {
            return c.json({ error: '未授权' }, 401);
        }
    }
    catch (error) {
        return c.json({ error: '认证失败' }, 401);
    }
};
// Admin routes (each protected by requireAuth)
const adminRoutes = new hono_1.Hono();
// 获取状态页配置
adminRoutes.get('/config', requireAuth, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.id;
    try {
        // 获取用户的状态页配置
        const configResult = await c.env.DB.prepare('SELECT * FROM status_page_config WHERE user_id = ?').bind(userId).all();
        let config = null;
        if (configResult.results && configResult.results.length > 0) {
            config = configResult.results[0];
        }
        // 获取配置的监控项
        const monitorsResult = await c.env.DB.prepare('SELECT m.id, m.name, CASE WHEN spm.monitor_id IS NOT NULL THEN 1 ELSE 0 END as selected ' +
            'FROM monitors m ' +
            'LEFT JOIN status_page_monitors spm ON m.id = spm.monitor_id AND spm.config_id = ? ' +
            'WHERE m.created_by = ?').bind(config?.id || 0, userId).all();
        // 获取配置的客户端
        const agentsResult = await c.env.DB.prepare('SELECT a.id, a.name, CASE WHEN spa.agent_id IS NOT NULL THEN 1 ELSE 0 END as selected ' +
            'FROM agents a ' +
            'LEFT JOIN status_page_agents spa ON a.id = spa.agent_id AND spa.config_id = ? ' +
            'WHERE a.created_by = ?').bind(config?.id || 0, userId).all();
        // 构建响应
        const response = {
            title: config?.title || '系统状态',
            description: config?.description || '当前系统运行状态',
            logoUrl: config?.logo_url || '',
            customCss: config?.custom_css || '',
            monitors: monitorsResult.results?.map(m => ({
                id: m.id,
                name: m.name,
                selected: m.selected === 1
            })) || [],
            agents: agentsResult.results?.map(a => ({
                id: a.id,
                name: a.name,
                selected: a.selected === 1
            })) || []
        };
        return c.json(response);
    }
    catch (error) {
        console.error('获取状态页配置失败:', error);
        return c.json({ error: '获取状态页配置失败' }, 500);
    }
});
// 保存状态页配置
adminRoutes.post('/config', requireAuth, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.id;
    const data = await c.req.json();
    console.log('接收到的配置数据:', JSON.stringify(data));
    if (!data) {
        console.log('无效的请求数据');
        return c.json({ error: '无效的请求数据' }, 400);
    }
    try {
        // 检查是否已存在配置
        const existingConfig = await c.env.DB.prepare('SELECT id FROM status_page_config WHERE user_id = ?').bind(userId).first();
        console.log('现有配置查询结果:', existingConfig);
        let configId;
        if (existingConfig && existingConfig.id) {
            // 更新现有配置
            console.log('更新现有配置ID:', existingConfig.id);
            await c.env.DB.prepare('UPDATE status_page_config SET title = ?, description = ?, logo_url = ?, custom_css = ? WHERE id = ?').bind(data.title, data.description, data.logoUrl, data.customCss, existingConfig.id).run();
            configId = existingConfig.id;
        }
        else {
            // 创建新配置
            console.log('创建新配置');
            const insertResult = await c.env.DB.prepare('INSERT INTO status_page_config (user_id, title, description, logo_url, custom_css) VALUES (?, ?, ?, ?, ?)').bind(userId, data.title, data.description, data.logoUrl, data.customCss).run();
            console.log('插入配置结果:', insertResult);
            if (!insertResult.success) {
                throw new Error('创建状态页配置失败');
            }
            // 获取新插入的ID
            const lastInsertId = await c.env.DB.prepare('SELECT last_insert_rowid() as id').first();
            console.log('获取的最后插入ID:', lastInsertId);
            if (!lastInsertId || typeof lastInsertId.id !== 'number') {
                throw new Error('获取配置ID失败');
            }
            configId = lastInsertId.id;
        }
        // 清除现有的监控项关联
        console.log('清除配置ID的现有监控关联:', configId);
        const deleteMonitorsResult = await c.env.DB.prepare('DELETE FROM status_page_monitors WHERE config_id = ?').bind(configId).run();
        console.log('删除现有监控关联结果:', deleteMonitorsResult);
        // 清除现有的客户端关联
        console.log('清除配置ID的现有客户端关联:', configId);
        const deleteAgentsResult = await c.env.DB.prepare('DELETE FROM status_page_agents WHERE config_id = ?').bind(configId).run();
        console.log('删除现有客户端关联结果:', deleteAgentsResult);
        // 添加选定的监控项
        console.log('接收到的监控项IDs:', data.monitors);
        if (Array.isArray(data.monitors) && data.monitors.length > 0) {
            console.log(`添加 ${data.monitors.length} 个监控项`);
            for (const monitorId of data.monitors) {
                const insertResult = await c.env.DB.prepare('INSERT INTO status_page_monitors (config_id, monitor_id) VALUES (?, ?)').bind(configId, monitorId).run();
                console.log(`添加监控项 ${monitorId} 结果:`, insertResult);
            }
        }
        else {
            console.log('没有选中的监控项需要添加');
        }
        // 添加选定的客户端
        console.log('接收到的客户端IDs:', data.agents);
        if (Array.isArray(data.agents) && data.agents.length > 0) {
            console.log(`添加 ${data.agents.length} 个客户端`);
            for (const agentId of data.agents) {
                const insertResult = await c.env.DB.prepare('INSERT INTO status_page_agents (config_id, agent_id) VALUES (?, ?)').bind(configId, agentId).run();
                console.log(`添加客户端 ${agentId} 结果:`, insertResult);
            }
        }
        else {
            console.log('没有选中的客户端需要添加');
        }
        return c.json({ success: true, configId });
    }
    catch (error) {
        console.error('保存状态页配置失败:', error);
        return c.json({ error: '保存状态页配置失败' }, 500);
    }
});
// 获取 webhook 通知配置
adminRoutes.get('/webhook', requireAuth, async (c) => {
    const payload = c.get('jwtPayload');
    try {
        let cfg = await c.env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(payload.id).first();
        if (!cfg) {
            const now = new Date().toISOString();
            await c.env.DB.prepare(`INSERT INTO webhook_config (user_id, created_at, updated_at) VALUES (?, ?, ?)`).bind(payload.id, now, now).run();
            cfg = await c.env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(payload.id).first();
        }
        return c.json({ success: true, config: cfg });
    }
    catch (e) {
        return c.json({ success: false, message: '获取通知配置失败' }, 500);
    }
});
// 保存 webhook 通知配置
adminRoutes.post('/webhook', requireAuth, async (c) => {
    const payload = c.get('jwtPayload');
    try {
        const data = await c.req.json();
        const now = new Date().toISOString();
        const existing = await c.env.DB.prepare('SELECT id FROM webhook_config WHERE user_id = ?').bind(payload.id).first();
        if (existing) {
            await c.env.DB.prepare(`UPDATE webhook_config SET webhook_url=?, webhook_method=?, webhook_content_type=?, webhook_body_down=?, webhook_body_up=?, webhook_headers=?, webhook_tls_verify=?, notify_down=?, notify_up=?, agent_notify_down=?, agent_notify_up=?, agent_webhook_body_down=?, agent_webhook_body_up=?, api_webhook_body_down=?, api_webhook_body_up=?, updated_at=? WHERE user_id=?`)
                .bind(data.webhookUrl || '', data.webhookMethod || 'POST', data.webhookContentType || 'json', data.webhookBodyDown || '', data.webhookBodyUp || '', data.webhookHeaders || '', data.webhookTlsVerify ? 1 : 0, data.notifyDown ? 1 : 0, data.notifyUp ? 1 : 0, data.agentNotifyDown ? 1 : 0, data.agentNotifyUp ? 1 : 0, data.agentWebhookBodyDown || '', data.agentWebhookBodyUp || '', data.apiWebhookBodyDown || '', data.apiWebhookBodyUp || '', now, payload.id).run();
        }
        else {
            await c.env.DB.prepare(`INSERT INTO webhook_config (user_id, webhook_url, webhook_method, webhook_content_type, webhook_body_down, webhook_body_up, webhook_headers, webhook_tls_verify, notify_down, notify_up, agent_notify_down, agent_notify_up, agent_webhook_body_down, agent_webhook_body_up, api_webhook_body_down, api_webhook_body_up, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
                .bind(payload.id, data.webhookUrl || '', data.webhookMethod || 'POST', data.webhookContentType || 'json', data.webhookBodyDown || '', data.webhookBodyUp || '', data.webhookHeaders || '', data.webhookTlsVerify ? 1 : 0, data.notifyDown ? 1 : 0, data.notifyUp ? 1 : 0, data.agentNotifyDown ? 1 : 0, data.agentNotifyUp ? 1 : 0, data.agentWebhookBodyDown || '', data.agentWebhookBodyUp || '', data.apiWebhookBodyDown || '', data.apiWebhookBodyUp || '', now, now).run();
        }
        return c.json({ success: true, message: '通知配置已保存' });
    }
    catch (e) {
        return c.json({ success: false, message: '保存通知配置失败' }, 500);
    }
});
// 真实通知测试 — 走与定时任务完全相同的发送路径（使用已保存的配置 + 真实开关/模板）
// 用它可定位「为什么不通知」：会返回精确原因（开关关闭 / 未配置 URL / Webhook 返回码 等）
adminRoutes.post('/notify-test', requireAuth, async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.id;
    try {
        const { type, event, subjectId } = await c.req.json();
        const ev = event === 'up' ? 'up' : 'down';
        if (type === 'agent') {
            let agent = null;
            if (subjectId) {
                agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(subjectId).first();
            }
            if (!agent) {
                // 合成对象 — created_by 必须为当前用户，否则查不到通知配置
                agent = { id: 0, name: '测试客户端', hostname: 'test.example.com', ip_address: '127.0.0.1', os: 'Linux' };
            }
            agent.created_by = userId;
            const r = await (0, tasks_1.sendAgentNotification)(c.env, agent, ev);
            return c.json({ success: r.ok, reason: r.reason, status: r.status });
        }
        // API 监控
        let monitor = null;
        if (subjectId) {
            monitor = await c.env.DB.prepare('SELECT * FROM monitors WHERE id = ?').bind(subjectId).first();
        }
        if (!monitor) {
            monitor = {
                id: 0, name: '测试监控', url: 'https://example.com', method: 'GET',
                expected_status: 200, response_time: 120, uptime: 100, status: ev === 'down' ? 'up' : 'down',
                interval: 60, timeout: 30, tags: '', headers: '', body: '', active: 1,
            };
        }
        monitor.created_by = userId;
        const r = await (0, tasks_1.sendNotification)(c.env, monitor, ev);
        return c.json({ success: r.ok, reason: r.reason, status: r.status });
    }
    catch (e) {
        return c.json({ success: false, reason: e.message || '测试失败' }, 500);
    }
});
// 公共路由 - 获取单个监控的检查记录（可选认证）
app.get('/monitor/:id/checks', async (c) => {
    try {
        const monitorId = parseInt(c.req.param('id'));
        const limit = Math.min(parseInt(c.req.query('limit') || '10') || 10, 50);
        let isAuthenticated = false;
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.slice(7);
                const secret = (0, jwt_2.getJwtSecret)(c);
                await (0, jwt_1.verify)(token, secret);
                isAuthenticated = true;
            }
            catch { /* ignore */ }
        }
        // Verify monitor exists and is accessible
        const monitor = await c.env.DB.prepare('SELECT id, public FROM monitors WHERE id = ?').bind(monitorId).first();
        if (!monitor)
            return c.json({ success: false, message: '监控不存在' }, 404);
        if (!isAuthenticated && !monitor.public)
            return c.json({ success: false, message: '无权访问' }, 403);
        const checks = await c.env.DB.prepare(`SELECT status, response_time, status_code, checked_at
       FROM monitor_checks WHERE monitor_id = ?
       ORDER BY checked_at DESC LIMIT ?`).bind(monitorId, limit).all();
        return c.json({ success: true, checks: (checks.results || []).reverse() });
    }
    catch (error) {
        console.error('获取监控检查记录失败:', error);
        return c.json({ success: false, message: '获取检查记录失败' }, 500);
    }
});
// ── Webhook 发送函数 ──────────────────────────────────────
async function sendWebhookNotification(env, userId, event, vars) {
    try {
        const cfg = await env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(userId).first();
        if (!cfg || !cfg.webhook_url)
            return;
        if (event === 'down' && !cfg.notify_down)
            return;
        if (event === 'up' && !cfg.notify_up)
            return;
        const template = event === 'down' ? (cfg.webhook_body_down || '') : (cfg.webhook_body_up || '');
        let body = template;
        for (const [k, v] of Object.entries(vars)) {
            body = body.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
        }
        const reqHeaders = {};
        if (cfg.webhook_headers) {
            cfg.webhook_headers.split('\n').forEach((line) => {
                const idx = line.indexOf(':');
                if (idx > 0)
                    reqHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
            });
        }
        if (cfg.webhook_method === 'POST') {
            reqHeaders['Content-Type'] = cfg.webhook_content_type === 'json' ? 'application/json' : 'text/plain';
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(cfg.webhook_url, {
            method: cfg.webhook_method || 'POST',
            headers: reqHeaders,
            body: cfg.webhook_method !== 'GET' ? body : undefined,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        console.log(`Webhook sent: ${event} → ${cfg.webhook_url} → ${res.status}`);
    }
    catch (e) {
        console.error(`Webhook failed (${event}):`, e.message);
    }
}
// Webhook 测试代理（绕过浏览器 CORS）
app.post('/webhook-test', async (c) => {
    try {
        const { url, method, headers, body, content_type, tls_verify } = await c.req.json();
        if (!url)
            return c.json({ success: false, message: '缺少 URL' }, 400);
        const fetchHeaders = { ...headers };
        if (method === 'POST' && body) {
            fetchHeaders['Content-Type'] = content_type === 'json' ? 'application/json' : 'text/plain';
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, {
            method: method || 'POST',
            headers: fetchHeaders,
            body: method !== 'GET' ? body : undefined,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const resBody = await res.text().catch(() => '');
        return c.json({
            success: true,
            status: res.status,
            statusText: res.statusText,
            body: resBody.slice(0, 500),
        });
    }
    catch (e) {
        return c.json({ success: false, message: e.message || '请求失败' });
    }
});
// 健康检查
app.get('/health', async (c) => {
    try {
        const u = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
        const m = await c.env.DB.prepare('SELECT COUNT(*) as count FROM monitors').first();
        const a = await c.env.DB.prepare('SELECT COUNT(*) as count FROM agents').first();
        return c.json({ status: 'ok', users: u?.count || 0, monitors: m?.count || 0, agents: a?.count || 0 });
    }
    catch (e) {
        return c.json({ status: 'error', message: e.message }, 500);
    }
});
// 公共路由 - 获取状态页数据（登录用户看全部，游客只看公开）
app.get('/data', async (c) => {
    try {
        // Check if user is authenticated via JWT
        let isAuthenticated = false;
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.slice(7);
                const secret = (0, jwt_2.getJwtSecret)(c);
                await (0, jwt_1.verify)(token, secret);
                isAuthenticated = true;
            }
            catch { /* ignore invalid tokens */ }
        }
        const monitorQuery = isAuthenticated
            ? "SELECT * FROM monitors WHERE active = 1 ORDER BY sort_order ASC, created_at DESC"
            : "SELECT * FROM monitors WHERE active = 1 AND public = 1 ORDER BY sort_order ASC, created_at DESC";
        const agentQuery = isAuthenticated
            ? "SELECT * FROM agents ORDER BY sort_order ASC, created_at DESC"
            : "SELECT * FROM agents WHERE public = 1 ORDER BY sort_order ASC, created_at DESC";
        const monitors = await c.env.DB.prepare(monitorQuery).all();
        const agents = await c.env.DB.prepare(agentQuery).all();
        // Batch load all monitor status history in one query
        const monitorList = (monitors.results || []);
        const historyMap = new Map();
        if (monitorList.length > 0) {
            try {
                const ids = monitorList.map((m) => m.id);
                // Query 24*N rows at once — SQLite has no IN limit at this scale
                const placeholders = ids.map(() => '?').join(',');
                const allHistory = await c.env.DB.prepare(`SELECT monitor_id, status FROM monitor_status_history
           WHERE monitor_id IN (${placeholders})
           ORDER BY monitor_id, timestamp DESC`).bind(...ids).all();
                for (const row of (allHistory.results || [])) {
                    if (!historyMap.has(row.monitor_id))
                        historyMap.set(row.monitor_id, []);
                    const arr = historyMap.get(row.monitor_id);
                    if (arr.length < 24)
                        arr.push(row.status);
                }
            }
            catch { /* fallback: empty history */ }
        }
        const enrichedMonitors = monitorList.map((monitor) => {
            const { url, ...rest } = monitor;
            const hist = historyMap.get(monitor.id) || [];
            return { ...rest, history: hist.reverse() };
        });
        // Slim agent fields — only return what the frontend actually renders
        const agentFields = ['id', 'name', 'status', 'created_at', 'updated_at',
            'cpu_usage', 'memory_total', 'memory_used', 'disk_total', 'disk_used',
            'network_rx', 'network_tx', 'network_rx_total', 'network_tx_total',
            'hostname', 'os', 'version', 'cpu_arch', 'cpu_model_name',
            'cpu_cores', 'load1', 'load5', 'load15', 'boot_time', 'agent_version',
            'country', 'connected_at', 'traffic_limit', 'expiry_time', 'start_time',
            'duration_value', 'duration_unit', 'category', 'tags', 'public',
            'process_count', 'tcp_count', 'udp_count'];
        const enrichedAgents = (agents.results || []).map((agent) => {
            const picked = {};
            for (const k of agentFields)
                picked[k] = agent[k];
            const memoryPercent = picked.memory_total && picked.memory_used
                ? (picked.memory_used / picked.memory_total) * 100 : null;
            const diskPercent = picked.disk_total && picked.disk_used
                ? (picked.disk_used / picked.disk_total) * 100 : null;
            return {
                ...picked,
                cpu: picked.cpu_usage || 0,
                memory: memoryPercent || 0,
                disk: diskPercent || 0,
            };
        });
        // Read saved status page config (use first available)
        let pageConfig = { title: '系统状态', description: '实时监控系统运行状态', logoUrl: '', customCss: '' };
        try {
            const config = await c.env.DB.prepare('SELECT * FROM status_page_config LIMIT 1').first();
            if (config) {
                pageConfig = {
                    title: config.title || pageConfig.title,
                    description: config.description || pageConfig.description,
                    logoUrl: config.logo_url || '',
                    customCss: config.custom_css || '',
                };
            }
        }
        catch { /* use defaults */ }
        return c.json({
            success: true,
            data: {
                title: pageConfig.title,
                description: pageConfig.description,
                logoUrl: pageConfig.logoUrl,
                customCss: pageConfig.customCss,
                monitors: enrichedMonitors,
                agents: enrichedAgents,
            }
        });
    }
    catch (error) {
        console.error('获取状态页数据失败:', error);
        return c.json({ success: false, message: '获取状态页数据失败' }, 500);
    }
});
app.route('/', adminRoutes);
exports.default = app;
