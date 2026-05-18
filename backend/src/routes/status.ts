import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
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

// 公共路由 - 获取公开状态页数据
app.get('/data', async (c) => {
  try {
    // Get all public agents and monitors directly
    const monitors = await c.env.DB.prepare(
      "SELECT * FROM monitors WHERE active = 1 AND public = 1 ORDER BY created_at DESC"
    ).all<any>();
    const agents = await c.env.DB.prepare(
      "SELECT * FROM agents WHERE public = 1 ORDER BY created_at DESC"
    ).all<any>();

    // Enrich agents with computed fields
    const enrichedAgents = (agents.results || []).map((agent: any) => {
      const memoryPercent = agent.memory_total && agent.memory_used
        ? (agent.memory_used / agent.memory_total) * 100 : null;
      const diskPercent = agent.disk_total && agent.disk_used
        ? (agent.disk_used / agent.disk_total) * 100 : null;
      return {
        ...agent,
        cpu: agent.cpu_usage || 0,
        memory: memoryPercent || 0,
        disk: diskPercent || 0,
      };
    });

    return c.json({
      success: true,
      data: {
        title: '系统状态',
        description: '实时监控系统运行状态',
        monitors: monitors.results || [],
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