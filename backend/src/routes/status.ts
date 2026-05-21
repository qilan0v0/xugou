import { Hono } from 'hono';
import { jwt, verify } from 'hono/jwt';
import { Bindings } from '../models/db';
import { getJwtSecret } from '../utils/jwt';

// 状态页配置接口定义
interface StatusPageConfig {
  title: string;
  description: string;
  logoUrl: string;
  customCss: string;
  monitors: Array<{
    id: number;
    name: string;
    selected: boolean;
  }>;
  agents: Array<{
    id: number;
    name: string;
    selected: boolean;
  }>;
}

// 监控项接口
interface Monitor {
  id: number;
  name: string;
  url: string;
  method: string;
  interval: number;
  timeout: number;
  expected_status: number;
  headers: string;
  body: string;
  created_by: number;
  active: boolean;
  status: string;
  uptime: number;
  response_time: number;
  last_checked?: string;
  created_at: string;
  updated_at: string;
  history?: string[];
}

// 客户端接口
interface Agent {
  id: number;
  name: string;
  token: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  status?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  network_rx?: number;
  network_tx?: number;
  hostname?: string;
  ip_address?: string;
  os?: string;
  version?: string;
  cpu_arch?: string;
  cpu_model_name?: string;
  cpu_cores?: number;
  load1?: number;
  load5?: number;
  load15?: number;
  boot_time?: string;
  network_rx_total?: number;
  network_tx_total?: number;
  agent_version?: string;
}

// 数据库中的状态页配置记录
interface DbStatusPageConfig {
  id?: number;
  user_id: number;
  title: string;
  description: string;
  logo_url: string;
  custom_css: string;
}

// 数据库中的监控项记录
interface DbMonitorItem {
  monitor_id: number;
}

// 数据库中的客户端记录
interface DbAgentItem {
  agent_id: number;
}

// 创建 Hono 路由
const app = new Hono<{ Bindings: Bindings }>();

// 保护管理员路由
const adminRoutes = new Hono<{ Bindings: Bindings }>()
  .use('*', async (c, next) => {
    try {
      const jwtMiddleware = jwt({ alg: "HS256", 
        secret: getJwtSecret(c)
      });
      await jwtMiddleware(c, next);
      
      const payload = c.get('jwtPayload');
      if (!payload || !payload.id) {
        return c.json({ error: '未授权' }, 401);
      }
      
      // 这里不再调用next()，防止重复调用
    } catch (error) {
      console.error('JWT认证错误:', error);
      return c.json({ error: '认证失败' }, 401);
    }
  });

// 获取状态页配置
adminRoutes.get('/config', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.id;
  
  try {
    // 获取用户的状态页配置
    const configResult = await c.env.DB.prepare(
      'SELECT * FROM status_page_config WHERE user_id = ?'
    ).bind(userId).all<DbStatusPageConfig>();
    
    let config: DbStatusPageConfig | null = null;
    if (configResult.results && configResult.results.length > 0) {
      config = configResult.results[0];
    }
    
    // 获取配置的监控项
    const monitorsResult = await c.env.DB.prepare(
      'SELECT m.id, m.name, CASE WHEN spm.monitor_id IS NOT NULL THEN 1 ELSE 0 END as selected ' +
      'FROM monitors m ' +
      'LEFT JOIN status_page_monitors spm ON m.id = spm.monitor_id AND spm.config_id = ? ' +
      'WHERE m.created_by = ?'
    ).bind(config?.id || 0, userId).all<{id: number, name: string, selected: number}>();
    
    // 获取配置的客户端
    const agentsResult = await c.env.DB.prepare(
      'SELECT a.id, a.name, CASE WHEN spa.agent_id IS NOT NULL THEN 1 ELSE 0 END as selected ' +
      'FROM agents a ' +
      'LEFT JOIN status_page_agents spa ON a.id = spa.agent_id AND spa.config_id = ? ' +
      'WHERE a.created_by = ?'
    ).bind(config?.id || 0, userId).all<{id: number, name: string, selected: number}>();
    
    // 构建响应
    const response: StatusPageConfig = {
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
  } catch (error) {
    console.error('获取状态页配置失败:', error);
    return c.json({ error: '获取状态页配置失败' }, 500);
  }
});

// 保存状态页配置
adminRoutes.post('/config', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.id;
  const data = await c.req.json() as StatusPageConfig;
  
  console.log('接收到的配置数据:', JSON.stringify(data));
  
  if (!data) {
    console.log('无效的请求数据');
    return c.json({ error: '无效的请求数据' }, 400);
  }
  
  try {
    // 检查是否已存在配置
    const existingConfig = await c.env.DB.prepare(
      'SELECT id FROM status_page_config WHERE user_id = ?'
    ).bind(userId).first<{id: number}>();
    
    console.log('现有配置查询结果:', existingConfig);
    
    let configId: number;
    
    if (existingConfig && existingConfig.id) {
      // 更新现有配置
      console.log('更新现有配置ID:', existingConfig.id);
      await c.env.DB.prepare(
        'UPDATE status_page_config SET title = ?, description = ?, logo_url = ?, custom_css = ? WHERE id = ?'
      ).bind(
        data.title,
        data.description,
        data.logoUrl,
        data.customCss,
        existingConfig.id
      ).run();
      
      configId = existingConfig.id;
    } else {
      // 创建新配置
      console.log('创建新配置');
      const insertResult = await c.env.DB.prepare(
        'INSERT INTO status_page_config (user_id, title, description, logo_url, custom_css) VALUES (?, ?, ?, ?, ?)'
      ).bind(
        userId,
        data.title,
        data.description,
        data.logoUrl,
        data.customCss
      ).run();
      
      console.log('插入配置结果:', insertResult);
      
      if (!insertResult.success) {
        throw new Error('创建状态页配置失败');
      }
      
      // 获取新插入的ID
      const lastInsertId = await c.env.DB.prepare('SELECT last_insert_rowid() as id').first<{ id: number }>();
      console.log('获取的最后插入ID:', lastInsertId);
      
      if (!lastInsertId || typeof lastInsertId.id !== 'number') {
        throw new Error('获取配置ID失败');
      }
      
      configId = lastInsertId.id;
    }
    
    // 清除现有的监控项关联
    console.log('清除配置ID的现有监控关联:', configId);
    const deleteMonitorsResult = await c.env.DB.prepare(
      'DELETE FROM status_page_monitors WHERE config_id = ?'
    ).bind(configId).run();
    console.log('删除现有监控关联结果:', deleteMonitorsResult);
    
    // 清除现有的客户端关联
    console.log('清除配置ID的现有客户端关联:', configId);
    const deleteAgentsResult = await c.env.DB.prepare(
      'DELETE FROM status_page_agents WHERE config_id = ?'
    ).bind(configId).run();
    console.log('删除现有客户端关联结果:', deleteAgentsResult);
    
    // 添加选定的监控项
    console.log('接收到的监控项IDs:', data.monitors);
    if (Array.isArray(data.monitors) && data.monitors.length > 0) {
      console.log(`添加 ${data.monitors.length} 个监控项`);
      for (const monitorId of data.monitors) {
        const insertResult = await c.env.DB.prepare(
          'INSERT INTO status_page_monitors (config_id, monitor_id) VALUES (?, ?)'
        ).bind(configId, monitorId).run();
        console.log(`添加监控项 ${monitorId} 结果:`, insertResult);
      }
    } else {
      console.log('没有选中的监控项需要添加');
    }
    
    // 添加选定的客户端
    console.log('接收到的客户端IDs:', data.agents);
    if (Array.isArray(data.agents) && data.agents.length > 0) {
      console.log(`添加 ${data.agents.length} 个客户端`);
      for (const agentId of data.agents) {
        const insertResult = await c.env.DB.prepare(
          'INSERT INTO status_page_agents (config_id, agent_id) VALUES (?, ?)'
        ).bind(configId, agentId).run();
        console.log(`添加客户端 ${agentId} 结果:`, insertResult);
      }
    } else {
      console.log('没有选中的客户端需要添加');
    }
    
    return c.json({ success: true, configId });
  } catch (error) {
    console.error('保存状态页配置失败:', error);
    return c.json({ error: '保存状态页配置失败' }, 500);
  }
});

// 获取 webhook 通知配置
adminRoutes.get('/webhook', async (c) => {
  const payload = c.get('jwtPayload');
  try {
    let cfg = await c.env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(payload.id).first<any>();
    if (!cfg) {
      const now = new Date().toISOString();
      await c.env.DB.prepare(`INSERT INTO webhook_config (user_id, created_at, updated_at) VALUES (?, ?, ?)`).bind(payload.id, now, now).run();
      cfg = await c.env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(payload.id).first<any>();
    }
    return c.json({ success: true, config: cfg });
  } catch (e: any) {
    return c.json({ success: false, message: '获取通知配置失败' }, 500);
  }
});

// 保存 webhook 通知配置
adminRoutes.post('/webhook', async (c) => {
  const payload = c.get('jwtPayload');
  try {
    const data = await c.req.json();
    const now = new Date().toISOString();
    const existing = await c.env.DB.prepare('SELECT id FROM webhook_config WHERE user_id = ?').bind(payload.id).first<{id:number}>();
    if (existing) {
      await c.env.DB.prepare(`UPDATE webhook_config SET webhook_url=?, webhook_method=?, webhook_content_type=?, webhook_body_down=?, webhook_body_up=?, webhook_headers=?, webhook_tls_verify=?, notify_down=?, notify_up=?, updated_at=? WHERE user_id=?`)
        .bind(data.webhookUrl||'', data.webhookMethod||'POST', data.webhookContentType||'json', data.webhookBodyDown||'', data.webhookBodyUp||'', data.webhookHeaders||'', data.webhookTlsVerify?1:0, data.notifyDown?1:0, data.notifyUp?1:0, now, payload.id).run();
    } else {
      await c.env.DB.prepare(`INSERT INTO webhook_config (user_id, webhook_url, webhook_method, webhook_content_type, webhook_body_down, webhook_body_up, webhook_headers, webhook_tls_verify, notify_down, notify_up, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(payload.id, data.webhookUrl||'', data.webhookMethod||'POST', data.webhookContentType||'json', data.webhookBodyDown||'', data.webhookBodyUp||'', data.webhookHeaders||'', data.webhookTlsVerify?1:0, data.notifyDown?1:0, data.notifyUp?1:0, now, now).run();
    }
    return c.json({ success: true, message: '通知配置已保存' });
  } catch (e: any) {
    return c.json({ success: false, message: '保存通知配置失败' }, 500);
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
        const secret = getJwtSecret(c);
        await verify(token, secret);
        isAuthenticated = true;
      } catch { /* ignore */ }
    }

    // Verify monitor exists and is accessible
    const monitor = await c.env.DB.prepare(
      'SELECT id, public FROM monitors WHERE id = ?'
    ).bind(monitorId).first<{id: number; public: number}>();
    if (!monitor) return c.json({ success: false, message: '监控不存在' }, 404);
    if (!isAuthenticated && !monitor.public) return c.json({ success: false, message: '无权访问' }, 403);

    const checks = await c.env.DB.prepare(
      `SELECT status, response_time, status_code, checked_at
       FROM monitor_checks WHERE monitor_id = ?
       ORDER BY checked_at DESC LIMIT ?`
    ).bind(monitorId, limit).all();

    return c.json({ success: true, checks: (checks.results || []).reverse() });
  } catch (error) {
    console.error('获取监控检查记录失败:', error);
    return c.json({ success: false, message: '获取检查记录失败' }, 500);
  }
});

// ── Webhook 发送函数 ──────────────────────────────────────
async function sendWebhookNotification(env: any, userId: number, event: 'down' | 'up', vars: Record<string, string>) {
  try {
    const cfg = await env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(userId).first<any>();
    if (!cfg || !cfg.webhook_url) return;
    if (event === 'down' && !cfg.notify_down) return;
    if (event === 'up' && !cfg.notify_up) return;

    const template = event === 'down' ? (cfg.webhook_body_down || '') : (cfg.webhook_body_up || '');
    let body = template;
    for (const [k, v] of Object.entries(vars)) {
      body = body.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }

    const reqHeaders: Record<string, string> = {};
    if (cfg.webhook_headers) {
      cfg.webhook_headers.split('\n').forEach((line: string) => {
        const idx = line.indexOf(':');
        if (idx > 0) reqHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
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
  } catch (e: any) {
    console.error(`Webhook failed (${event}):`, e.message);
  }
}

// Webhook 测试代理（绕过浏览器 CORS）
app.post('/webhook-test', async (c) => {
  try {
    const { url, method, headers, body, content_type, tls_verify } = await c.req.json();
    if (!url) return c.json({ success: false, message: '缺少 URL' }, 400);

    const fetchHeaders: Record<string,string> = { ...headers };
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
  } catch (e: any) {
    return c.json({ success: false, message: e.message || '请求失败' });
  }
});

// 健康检查
app.get('/health', async (c) => {
  try {
    const u = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{count: number}>();
    const m = await c.env.DB.prepare('SELECT COUNT(*) as count FROM monitors').first<{count: number}>();
    const a = await c.env.DB.prepare('SELECT COUNT(*) as count FROM agents').first<{count: number}>();
    return c.json({ status: 'ok', users: u?.count || 0, monitors: m?.count || 0, agents: a?.count || 0 });
  } catch (e: any) {
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
        const secret = getJwtSecret(c);
        await verify(token, secret);
        isAuthenticated = true;
      } catch { /* ignore invalid tokens */ }
    }

    const monitorQuery = isAuthenticated
      ? "SELECT * FROM monitors WHERE active = 1 ORDER BY sort_order ASC, created_at DESC"
      : "SELECT * FROM monitors WHERE active = 1 AND public = 1 ORDER BY sort_order ASC, created_at DESC";
    const agentQuery = isAuthenticated
      ? "SELECT * FROM agents ORDER BY sort_order ASC, created_at DESC"
      : "SELECT * FROM agents WHERE public = 1 ORDER BY sort_order ASC, created_at DESC";

    const monitors = await c.env.DB.prepare(monitorQuery).all<any>();
    const agents = await c.env.DB.prepare(agentQuery).all<any>();

    // Batch load all monitor status history in one query
    const monitorList = (monitors.results || []);
    const historyMap = new Map<number, {status: string; timestamp: string}[]>();
    if (monitorList.length > 0) {
      try {
        const ids = monitorList.map((m: any) => m.id);
        // Query 24*N rows at once — SQLite has no IN limit at this scale
        const placeholders = ids.map(() => '?').join(',');
        const allHistory = await c.env.DB.prepare(
          `SELECT monitor_id, status, timestamp FROM monitor_status_history
           WHERE monitor_id IN (${placeholders})
           ORDER BY monitor_id, timestamp DESC`
        ).bind(...ids).all<{monitor_id: number; status: string; timestamp: string}>();
        for (const row of (allHistory.results || [])) {
          if (!historyMap.has(row.monitor_id)) historyMap.set(row.monitor_id, []);
          const arr = historyMap.get(row.monitor_id)!;
          if (arr.length < 24) arr.push(row);
        }
      } catch { /* fallback: empty history */ }
    }

    const enrichedMonitors = monitorList.map((monitor: any) => {
      const { url, ...rest } = monitor;
      const hist = historyMap.get(monitor.id) || [];
      return { ...rest, history: hist.reverse() };
    });

    // Slim agent fields — only return what the frontend actually renders
    const agentFields = ['id','name','status','created_at','updated_at',
      'cpu_usage','memory_total','memory_used','disk_total','disk_used',
      'network_rx','network_tx','network_rx_total','network_tx_total',
      'hostname','os','version','cpu_arch','cpu_model_name',
      'cpu_cores','load1','load5','load15','boot_time','agent_version',
      'country','connected_at','traffic_limit','expiry_time','start_time',
      'duration_value','duration_unit','category','tags','public'];
    const enrichedAgents = (agents.results || []).map((agent: any) => {
      const picked: any = {};
      for (const k of agentFields) picked[k] = agent[k];
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
      const config = await c.env.DB.prepare('SELECT * FROM status_page_config LIMIT 1').first<any>();
      if (config) {
        pageConfig = {
          title: config.title || pageConfig.title,
          description: config.description || pageConfig.description,
          logoUrl: config.logo_url || '',
          customCss: config.custom_css || '',
        };
      }
    } catch { /* use defaults */ }

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
  } catch (error) {
    console.error('获取状态页数据失败:', error);
    return c.json({ success: false, message: '获取状态页数据失败' }, 500);
  }
});
app.route('/', adminRoutes);

export default app; 