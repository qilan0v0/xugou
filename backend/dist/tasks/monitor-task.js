"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
const hono_1 = require("hono");
const monitorTask = new hono_1.Hono();
async function sendNotification(env, monitor, event) {
    try {
        console.log(`[Webhook] 查找用户 ${monitor.created_by} 的通知配置...`);
        const cfg = await env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(monitor.created_by).first();
        if (!cfg) {
            console.log(`[Webhook] 用户 ${monitor.created_by} 无通知配置，跳过 (event=${event})`);
            return { ok: false, reason: `用户 ${monitor.created_by} 未配置通知` };
        }
        if (!cfg.webhook_url) {
            console.log(`[Webhook] webhook_url 为空，跳过 (event=${event})`);
            return { ok: false, reason: '未配置 Webhook URL' };
        }
        if (event === 'down' && !cfg.notify_down) {
            console.log(`[Webhook] notify_down=0 关闭，跳过 (monitor=${monitor.name})`);
            return { ok: false, reason: 'API监控「故障时通知」已关闭（请勾选后保存）' };
        }
        if (event === 'up' && !cfg.notify_up) {
            console.log(`[Webhook] notify_up=0 关闭，跳过 (monitor=${monitor.name})`);
            return { ok: false, reason: 'API监控「恢复时通知」已关闭（请勾选后保存）' };
        }
        console.log(`[Webhook] 准备发送 ${event} 通知: ${monitor.name} → ${cfg.webhook_url} (notify_down=${cfg.notify_down}, notify_up=${cfg.notify_up})`);
        const now = new Date().toISOString();
        const prevStatus = monitor.status || 'pending';
        const vars = {
            name: monitor.name, status: event === 'down' ? '故障' : '已恢复', time: now,
            previous_status: prevStatus, url: monitor.url,
            method: monitor.method, expected_status: String(monitor.expected_status || 200),
            response_time: String(monitor.response_time || 0),
            uptime: monitor.uptime ? `${monitor.uptime.toFixed(1)}%` : '',
            message: event === 'down' ? `${monitor.name} 出现故障` : `${monitor.name} 已恢复正常`,
            monitor_id: String(monitor.id),
            interval: String(monitor.interval),
            timeout: String(monitor.timeout),
            tags: monitor.tags || '',
            last_checked: monitor.last_checked || '',
            created_at: monitor.created_at || '',
            active: monitor.active ? '是' : '否',
            headers: monitor.headers || '',
            body: monitor.body || '',
            hostname: '', ip: '', os: '', cpu: '', memory: '', disk: '', country: '',
            version: '', cpu_cores: '', cpu_model: '', cpu_arch: '', memory_total: '', disk_total: '',
            load: '', agent_version: '', boot_time: '', connected_at: '',
            network_rx_total: '', network_tx_total: '', traffic_total: '',
        };
        const template = event === 'down' ? (cfg.api_webhook_body_down || cfg.webhook_body_down || '') : (cfg.api_webhook_body_up || cfg.webhook_body_up || '');
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
        console.log(`[Webhook] 发送 ${event} 通知 → ${cfg.webhook_url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(cfg.webhook_url, {
            method: cfg.webhook_method || 'POST',
            headers: reqHeaders,
            body: cfg.webhook_method !== 'GET' ? body : undefined,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        console.log(`[Webhook] 结果: ${monitor.name} ${event} → ${res.status}`);
        return { ok: res.ok, reason: res.ok ? '已发送' : `Webhook 返回 HTTP ${res.status}`, status: res.status };
    }
    catch (e) {
        console.error(`[Webhook] 失败 (${monitor.name} ${event}):`, e.message);
        return { ok: false, reason: `发送失败: ${e.message}` };
    }
}
// 清理30天以前的历史记录
async function cleanupOldRecords(c) {
    try {
        console.log('开始清理30天以前的历史记录...');
        // 清理监控状态历史记录
        const deleteStatusHistoryResult = await c.env.DB.prepare(`
      DELETE FROM monitor_status_history 
      WHERE timestamp < datetime('now', '-30 days')
    `).run();
        // 清理监控检查记录
        const deleteChecksResult = await c.env.DB.prepare(`
      DELETE FROM monitor_checks 
      WHERE checked_at < datetime('now', '-30 days')
    `).run();
        console.log(`清理完成：删除了 ${deleteStatusHistoryResult.meta?.changes || 0} 条状态历史记录，${deleteChecksResult.meta?.changes || 0} 条检查记录`);
        return {
            success: true,
            statusHistoryDeleted: deleteStatusHistoryResult.meta?.changes || 0,
            checksDeleted: deleteChecksResult.meta?.changes || 0
        };
    }
    catch (error) {
        console.error('清理历史记录出错:', error);
        return { success: false, error: String(error) };
    }
}
// 监控检查的主要函数
async function checkMonitors(c) {
    try {
        console.log('开始执行监控检查...');
        // 清理30天以前的历史记录
        await cleanupOldRecords(c);
        // 获取当前时间
        const now = new Date();
        // 查询需要检查的监控
        // 条件：active=true 且 (last_checked 为 null 或 当前时间 - last_checked > interval)
        const monitors = await c.env.DB.prepare(`
      SELECT * FROM monitors 
      WHERE active = true 
      AND (last_checked IS NULL OR datetime('now') > datetime(last_checked, '+' || interval || ' seconds'))
    `).all();
        console.log(`找到 ${monitors?.results?.length || 0} 个需要检查的监控`);
        if (!monitors.results || monitors.results.length === 0) {
            return { success: true, message: '没有需要检查的监控', checked: 0 };
        }
        // 检查每个监控
        const results = await Promise.all(monitors.results.map(async (monitor) => {
            return await checkSingleMonitor(c, monitor);
        }));
        return {
            success: true,
            message: '监控检查完成',
            checked: results.length,
            results: results
        };
    }
    catch (error) {
        console.error('监控检查出错:', error);
        return { success: false, message: '监控检查出错', error: String(error) };
    }
}
// 检查单个监控的函数
async function checkSingleMonitor(c, monitor) {
    try {
        console.log(`开始检查监控项: ${monitor.name} (${monitor.url})`);
        const startTime = Date.now();
        const response = await fetch(monitor.url, {
            method: monitor.method,
            headers: {
                'User-Agent': 'Qltz-Monitor/1.0',
                ...(monitor.headers ? JSON.parse(monitor.headers) : {})
            },
            body: monitor.body || undefined
        });
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        // 检查响应状态
        let isUp = false;
        // 支持状态码范围检查
        if (monitor.expected_status === 200) {
            // 如果是精确的状态码，就精确匹配
            isUp = response.status === monitor.expected_status;
        }
        else if (monitor.expected_status === 2) {
            // 如果是2，则表示2xx
            isUp = response.status >= 200 && response.status < 300;
        }
        else if (monitor.expected_status === 3) {
            // 如果是3，则表示3xx
            isUp = response.status >= 300 && response.status < 400;
        }
        else if (monitor.expected_status === 4) {
            // 如果是4，则表示4xx
            isUp = response.status >= 400 && response.status < 500;
        }
        else if (monitor.expected_status === 5) {
            // 如果是5，则表示5xx
            isUp = response.status >= 500 && response.status < 600;
        }
        else {
            // 其他情况，精确匹配
            isUp = response.status === monitor.expected_status;
        }
        const status = isUp ? 'up' : 'down';
        const prevStatus = monitor.status;
        // 状态变化时发送通知 (up↔down 或 pending→up/down)
        if (prevStatus !== status) {
            console.log(`[Webhook] 状态变化: ${monitor.name} ${prevStatus} → ${status}`);
            sendNotification(c.env, monitor, status === 'down' ? 'down' : 'up');
        }
        // 记录状态历史
        await c.env.DB.prepare(`INSERT INTO monitor_status_history (monitor_id, status, timestamp) 
       VALUES (?, ?, datetime('now'))`).bind(monitor.id, status).run();
        // 记录检查详情
        await c.env.DB.prepare(`INSERT INTO monitor_checks (monitor_id, status, response_time, status_code, checked_at) 
       VALUES (?, ?, ?, ?, datetime('now'))`).bind(monitor.id, status, responseTime, response.status).run();
        // 更新监控项状态
        await c.env.DB.prepare(`UPDATE monitors 
       SET status = ?, 
           last_checked = datetime('now'),
           response_time = ?,
           uptime = (
             SELECT ROUND((COUNT(CASE WHEN status = 'up' THEN 1 ELSE NULL END) * 100.0 / COUNT(*)), 2)
             FROM monitor_status_history
             WHERE monitor_id = ?
             ORDER BY timestamp DESC
             LIMIT 100
           )
       WHERE id = ?`).bind(status, responseTime, monitor.id, monitor.id).run();
        console.log(`监控项检查完成: ${monitor.name}, 状态: ${status}, 响应时间: ${responseTime}ms`);
        return {
            success: true,
            status,
            responseTime
        };
    }
    catch (error) {
        console.error(`检查监控项失败: ${monitor.name}`, error);
        // 仅当之前是正常状态时才发故障通知
        if (monitor.status === 'up' || monitor.status === 'pending') {
            console.log(`[Webhook] 检查异常: ${monitor.name} ${monitor.status} → down`);
            sendNotification(c.env, monitor, 'down');
        }
        // 记录错误状态
        await c.env.DB.prepare(`INSERT INTO monitor_status_history (monitor_id, status, timestamp) 
       VALUES (?, ?, datetime('now'))`).bind(monitor.id, 'down').run();
        // 记录检查详情
        await c.env.DB.prepare(`INSERT INTO monitor_checks (monitor_id, status, response_time, status_code, error, checked_at) 
       VALUES (?, ?, ?, ?, ?, datetime('now'))`).bind(monitor.id, 'down', 0, 0, error.message).run();
        // 更新监控项状态
        await c.env.DB.prepare(`UPDATE monitors 
       SET status = 'down', 
           last_checked = datetime('now'),
           response_time = 0,
           uptime = (
             SELECT ROUND((COUNT(CASE WHEN status = 'up' THEN 1 ELSE NULL END) * 100.0 / COUNT(*)), 2)
             FROM monitor_status_history
             WHERE monitor_id = ?
             ORDER BY timestamp DESC
             LIMIT 100
           )
       WHERE id = ?`).bind(monitor.id, monitor.id).run();
        return {
            success: false,
            status: 'down',
            error: error.message
        };
    }
}
// 定义触发器路由 - 通过HTTP请求触发监控检查
monitorTask.get('/api/trigger-check', async (c) => {
    const result = await checkMonitors(c);
    return c.json(result);
});
// 在 Cloudflare Workers 中设置定时触发器
exports.default = {
    async scheduled(event, env, ctx) {
        const c = { env };
        await checkMonitors(c);
    },
    fetch: monitorTask.fetch
};
