// 定期检查客户端状态的任务
export const checkAgentsStatus = async (env: any) => {
  try {
    console.log('定时任务: 检查客户端状态...');

    const inactiveThreshold = 2 * 60 * 1000;
    const now = new Date();

    const activeAgents = await env.DB.prepare(
      "SELECT id, name, hostname, ip_address, os, cpu_usage, updated_at, created_by FROM agents WHERE status = 'active'"
    ).all();

    if (!activeAgents.results || activeAgents.results.length === 0) {
      console.log('定时任务: 没有活跃状态的客户端');
      return;
    }

    for (const agent of activeAgents.results) {
      const lastUpdateTime = new Date(agent.updated_at);
      const timeDiff = now.getTime() - lastUpdateTime.getTime();

      if (timeDiff > inactiveThreshold) {
        console.log(`定时任务: 客户端 ${agent.name} (ID: ${agent.id}) 超过2分钟未上报，设置为离线`);

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
async function sendAgentNotification(env: any, agent: any, event: 'down' | 'up') {
  try {
    console.log(`[Webhook-Agent] 查找用户 ${agent.created_by} 的通知配置...`);
    const cfg = await env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(agent.created_by).first<any>();
    if (!cfg || !cfg.webhook_url) { console.log('[Webhook-Agent] 无配置或URL为空，跳过'); return; }
    if (event === 'down' && !cfg.notify_down) return;
    if (event === 'up' && !cfg.notify_up) return;

    const now = new Date().toISOString();
    const memPct = agent.memory_total && agent.memory_used ? Math.round((agent.memory_used/agent.memory_total)*100) : 0;
    const diskPct = agent.disk_total && agent.disk_used ? Math.round((agent.disk_used/agent.disk_total)*100) : 0;
    const upMs = agent.boot_time ? Math.max(0, Date.now() - new Date(agent.boot_time).getTime()) : 0;

    const vars: Record<string,string> = {
      name: agent.name, status: event === 'down' ? '离线' : '在线', time: now,
      hostname: agent.hostname || '', ip: agent.ip_address || '', os: agent.os || '',
      cpu: agent.cpu_usage ? `${Math.round(agent.cpu_usage)}%` : '',
      memory: memPct ? `${memPct}%` : '',
      disk: diskPct ? `${diskPct}%` : '',
      uptime: upMs ? `${Math.floor(upMs/86400000)}d${Math.floor((upMs%86400000)/3600000)}h` : '',
      country: agent.country || '',
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

    console.log(`[Webhook-Agent] 发送 ${event} → ${cfg.webhook_url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(cfg.webhook_url, {
      method: cfg.webhook_method || 'POST',
      headers: reqHeaders,
      body: cfg.webhook_method !== 'GET' ? body : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    console.log(`[Webhook-Agent] 结果: ${agent.name} ${event} → ${res.status}`);
  } catch (e: any) {
    console.error(`[Webhook-Agent] 失败 (${agent.name} ${event}):`, e.message);
  }
} 