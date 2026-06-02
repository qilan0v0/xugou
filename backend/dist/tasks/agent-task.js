"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAgentsStatus = void 0;
exports.sendAgentNotification = sendAgentNotification;
const notify_1 = require("../utils/notify");
// 定期检查客户端状态的任务
const checkAgentsStatus = async (env) => {
    try {
        console.log('定时任务: 检查客户端状态...');
        const inactiveThreshold = 2 * 60 * 1000;
        const now = new Date();
        const activeAgents = await env.DB.prepare("SELECT * FROM agents WHERE status = 'active'").all();
        if (!activeAgents.results || activeAgents.results.length === 0) {
            console.log('定时任务: 没有活跃状态的客户端');
            return;
        }
        for (const agent of activeAgents.results) {
            const lastUpdateTime = new Date(agent.updated_at);
            const timeDiff = now.getTime() - lastUpdateTime.getTime();
            if (timeDiff > inactiveThreshold) {
                console.log(`[离线] ${agent.name} (${agent.hostname || '?'}) 超过2分钟未上报，设置为离线`);
                await env.DB.prepare("UPDATE agents SET status = 'inactive' WHERE id = ?").bind(agent.id).run();
                // 发送离线通知
                sendAgentNotification(env, agent, 'down');
            }
        }
    }
    catch (error) {
        console.error('定时任务: 检查客户端状态出错:', error);
    }
};
exports.checkAgentsStatus = checkAgentsStatus;
async function sendAgentNotification(env, agent, event) {
    try {
        const cfg = await env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(agent.created_by).first();
        if (!cfg || !cfg.webhook_url) {
            if (event === 'up')
                console.log(`[通知] ${agent.name} 上线但未配置 webhook URL，跳过通知`);
            return { ok: false, reason: '未配置 Webhook URL' };
        }
        if (event === 'down' && !cfg.agent_notify_down)
            return { ok: false, reason: '客户端「离线时通知」已关闭（请勾选后保存）' };
        if (event === 'up' && !cfg.agent_notify_up) {
            console.log(`[通知] ${agent.name} 上线但 agent_notify_up 已关闭，跳过通知`);
            return { ok: false, reason: '客户端「上线时通知」已关闭（请勾选后保存）' };
        }
        const now = new Date().toISOString();
        const memPct = agent.memory_total && agent.memory_used ? Math.round((agent.memory_used / agent.memory_total) * 100) : 0;
        const diskPct = agent.disk_total && agent.disk_used ? Math.round((agent.disk_used / agent.disk_total) * 100) : 0;
        const upMs = agent.boot_time ? Math.max(0, Date.now() - new Date(agent.boot_time).getTime()) : 0;
        const upDays = upMs ? Math.floor(upMs / 86400000) : 0;
        const upHours = upMs ? Math.floor((upMs % 86400000) / 3600000) : 0;
        const memTotalGB = agent.memory_total ? (agent.memory_total / 1073741824).toFixed(1) : '';
        const memUsedGB = agent.memory_used ? (agent.memory_used / 1073741824).toFixed(2) : '';
        const diskTotalGB = agent.disk_total ? (agent.disk_total / 1073741824).toFixed(1) : '';
        const diskUsedGB = agent.disk_used ? (agent.disk_used / 1073741824).toFixed(1) : '';
        const netRxTotal = agent.network_rx_total ? (agent.network_rx_total / 1073741824).toFixed(2) : '';
        const netTxTotal = agent.network_tx_total ? (agent.network_tx_total / 1073741824).toFixed(2) : '';
        const totalTraffic = ((agent.network_rx_total || 0) + (agent.network_tx_total || 0)) / 1073741824;
        const fmtRate = (kb) => kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB/s` : `${kb.toFixed(1)} KB/s`;
        const fmtDateTime = (s) => { try {
            return new Date(s).toLocaleString('zh-CN');
        }
        catch {
            return s || '';
        } };
        const vars = {
            name: agent.name || '',
            status: event === 'down' ? '离线' : '在线',
            time: now,
            hostname: agent.hostname || '',
            ip: agent.ip_address || '',
            os: agent.os || '',
            version: agent.version || '',
            cpu: agent.cpu_usage ? `${Math.round(agent.cpu_usage)}%` : '',
            cpu_cores: agent.cpu_cores ? String(agent.cpu_cores) : '',
            cpu_model: agent.cpu_model_name || '',
            cpu_arch: agent.cpu_arch || '',
            memory: memPct ? `${memPct}%` : '',
            memory_total: memTotalGB ? `${memTotalGB} GiB` : '',
            memory_used: memUsedGB ? `${memUsedGB} GiB` : '',
            disk: diskPct ? `${diskPct}%` : '',
            disk_total: diskTotalGB ? `${diskTotalGB} GiB` : '',
            disk_used: diskUsedGB ? `${diskUsedGB} GiB` : '',
            uptime: upMs ? `${upDays}d ${upHours}h` : '',
            load: agent.load1 != null ? `${agent.load1.toFixed(2)} / ${(agent.load5 || 0).toFixed(2)} / ${(agent.load15 || 0).toFixed(2)}` : '',
            load1: agent.load1 != null ? agent.load1.toFixed(2) : '',
            load5: agent.load5 != null ? agent.load5.toFixed(2) : '',
            load15: agent.load15 != null ? agent.load15.toFixed(2) : '',
            country: agent.country || '',
            agent_version: agent.agent_version || '',
            boot_time: agent.boot_time ? fmtDateTime(agent.boot_time) : '',
            connected_at: agent.connected_at ? fmtDateTime(agent.connected_at) : '',
            network_rx: agent.network_rx != null ? fmtRate(agent.network_rx) : '',
            network_tx: agent.network_tx != null ? fmtRate(agent.network_tx) : '',
            network_rx_total: netRxTotal ? `${netRxTotal} GiB` : '',
            network_tx_total: netTxTotal ? `${netTxTotal} GiB` : '',
            traffic_total: totalTraffic ? `${totalTraffic.toFixed(2)} GiB` : '',
            process_count: agent.process_count != null ? String(agent.process_count) : '',
            tcp_count: agent.tcp_count != null ? String(agent.tcp_count) : '',
            udp_count: agent.udp_count != null ? String(agent.udp_count) : '',
            message: event === 'down' ? `${agent.name} 已离线` : `${agent.name} 已上线`,
            url: '', response_time: '',
        };
        const template = event === 'down' ? (cfg.agent_webhook_body_down || cfg.webhook_body_down || '') : (cfg.agent_webhook_body_up || cfg.webhook_body_up || '');
        const body = (0, notify_1.applyTemplate)(template, vars, { json: cfg.webhook_content_type === 'json' });
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
        console.log(`[通知] 发送${event === 'up' ? '上线' : '离线'}通知: ${agent.name} → ${cfg.webhook_url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(cfg.webhook_url, {
            method: cfg.webhook_method || 'POST',
            headers: reqHeaders,
            body: cfg.webhook_method !== 'GET' ? body : undefined,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const rBody = await res.text().catch(() => '');
        console.log(`[通知] 结果: ${agent.name} → HTTP ${res.status} ${res.statusText} | ${rBody.slice(0, 200)}`);
        return { ok: res.ok, reason: res.ok ? '已发送' : `Webhook 返回 HTTP ${res.status}`, status: res.status };
    }
    catch (e) {
        console.error(`[通知] ${event === 'up' ? '上线' : '离线'}通知失败: ${agent.name} | ${e.message}`);
        return { ok: false, reason: `发送失败: ${e.message}` };
    }
}
