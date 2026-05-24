// 定期检查客户端状态的任务
export const checkAgentsStatus = async (env: any) => {
  try {
    console.log('定时任务: 检查客户端状态...');

    const inactiveThreshold = 2 * 60 * 1000;
    const now = new Date();

    const activeAgents = await env.DB.prepare(
      "SELECT * FROM agents WHERE status = 'active'"
    ).all();

    if (!activeAgents.results || activeAgents.results.length === 0) {
      console.log('定时任务: 没有活跃状态的客户端');
      return;
    }

    for (const agent of activeAgents.results) {
      const lastUpdateTime = new Date(agent.updated_at);
      const timeDiff = now.getTime() - lastUpdateTime.getTime();

      if (timeDiff > inactiveThreshold) {
        console.log(`[离线] ${agent.name} (${agent.hostname || '?'}) 超过2分钟未上报，设置为离线`);

        await env.DB.prepare(
          "UPDATE agents SET status = 'inactive' WHERE id = ?"
        ).bind(agent.id).run();

        // 发送离线通知
        sendAgentNotification(env, agent, 'down');
      }
    }

  } catch (error) {
    console.error('定时任务: 检查客户端状态出错:', error);
  }
};

// ── Agent Webhook 通知 ────────────────────────────────────
export async function sendAgentNotification(env: any, agent: any, event: 'down' | 'up') {
  try {
    const cfg = await env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(agent.created_by).first() as any;
    if (!cfg || !cfg.webhook_url) {
      if (event === 'up') console.log(`[通知] ${agent.name} 上线但未配置 webhook URL，跳过通知`);
      return;
    }
    if (event === 'down' && !cfg.notify_down) return;
    if (event === 'up' && !cfg.notify_up) {
      console.log(`[通知] ${agent.name} 上线但 notify_up 已关闭，跳过通知`);
      return;
    }

    const now = new Date().toISOString();
    const memPct = agent.memory_total && agent.memory_used ? Math.round((agent.memory_used/agent.memory_total)*100) : 0;
    const diskPct = agent.disk_total && agent.disk_used ? Math.round((agent.disk_used/agent.disk_total)*100) : 0;
    const upMs = agent.boot_time ? Math.max(0, Date.now() - new Date(agent.boot_time).getTime()) : 0;

    const upDays = upMs ? Math.floor(upMs / 86400000) : 0;
    const upHours = upMs ? Math.floor((upMs % 86400000) / 3600000) : 0;
    const memTotalGB = agent.memory_total ? (agent.memory_total / 1073741824).toFixed(1) : '';
    const diskTotalGB = agent.disk_total ? (agent.disk_total / 1073741824).toFixed(1) : '';
    const netRxTotal = agent.network_rx_total ? (agent.network_rx_total / 1073741824).toFixed(2) : '';
    const netTxTotal = agent.network_tx_total ? (agent.network_tx_total / 1073741824).toFixed(2) : '';
    const totalTraffic = ((agent.network_rx_total || 0) + (agent.network_tx_total || 0)) / 1073741824;

    const fmtDateTime = (s: string) => { try { return new Date(s).toLocaleString('zh-CN'); } catch { return s || ''; } };

    const vars: Record<string,string> = {
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
      disk: diskPct ? `${diskPct}%` : '',
      disk_total: diskTotalGB ? `${diskTotalGB} GiB` : '',
      uptime: upMs ? `${upDays}d ${upHours}h` : '',
      load: agent.load1 != null ? `${agent.load1.toFixed(2)} / ${(agent.load5||0).toFixed(2)} / ${(agent.load15||0).toFixed(2)}` : '',
      country: agent.country || '',
      agent_version: agent.agent_version || '',
      boot_time: agent.boot_time ? fmtDateTime(agent.boot_time) : '',
      connected_at: agent.connected_at ? fmtDateTime(agent.connected_at) : '',
      network_rx_total: netRxTotal ? `${netRxTotal} GiB` : '',
      network_tx_total: netTxTotal ? `${netTxTotal} GiB` : '',
      traffic_total: totalTraffic ? `${totalTraffic.toFixed(2)} GiB` : '',
      message: event === 'down' ? `${agent.name} 已离线` : `${agent.name} 已上线`,
      url: '', response_time: '',
    };

    const template = event === 'down' ? (cfg.webhook_body_down || '') : (cfg.webhook_body_up || '');
    let body = template;
    for (const [k, v] of Object.entries(vars)) {
      body = body.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }

    const reqHeaders: Record<string,string> = {};
    if (cfg.webhook_headers) {
      cfg.webhook_headers.split('\n').forEach((line: string) => {
        const idx = line.indexOf(':');
        if (idx > 0) reqHeaders[line.slice(0,idx).trim()] = line.slice(idx+1).trim();
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
  } catch (e: any) {
    console.error(`[通知] ${event === 'up' ? '上线' : '离线'}通知失败: ${agent.name} | ${e.message}`);
  }
} 