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

// 公共路由
// 获取状态页数据（公开访问）
app.get('/data', async (c) => {
  try {
    // 获取所有配置
    console.log('获取状态页配置...');
    const configsResult = await c.env.DB.prepare(
      'SELECT * FROM status_page_config'
    ).all<DbStatusPageConfig>();
    
    console.log('状态页配置查询结果:', JSON.stringify(configsResult));
    
    if (!configsResult.results || configsResult.results.length === 0) {
      console.log('未找到状态页配置，返回默认配置');
      
      // 尝试创建一个默认配置
      const defaultConfig = await createDefaultConfig(c);
      if (defaultConfig) {
        return c.json({ 
          success: true,
          data: defaultConfig
        });
      }
      
      return c.json({ 
        success: true,
        data: {
          title: '系统状态',
          description: '实时监控系统状态',
          logoUrl: '',
          customCss: '',
          monitors: [],
          agents: []
        }
      });
    }
    
    // 简单处理：获取第一个配置
    const config = configsResult.results[0];
    console.log('找到状态页配置:', config);
    
    // 获取选中的监控项
    const selectedMonitors = await c.env.DB.prepare(
      'SELECT monitor_id FROM status_page_monitors WHERE config_id = ?'
    ).bind(config.id).all<{ monitor_id: number }>();
    
    console.log('选中的监控项:', JSON.stringify(selectedMonitors));
    
    // 获取选中的客户端
    const selectedAgents = await c.env.DB.prepare(
      'SELECT agent_id FROM status_page_agents WHERE config_id = ?'
    ).bind(config.id).all<{ agent_id: number }>();
    
    console.log('选中的客户端:', JSON.stringify(selectedAgents));
    
    // 获取监控项详细信息
    let monitors: Monitor[] = [];
    if (selectedMonitors.results && selectedMonitors.results.length > 0) {
      const monitorIds = selectedMonitors.results.map(m => m.monitor_id);
      const placeholders = monitorIds.map(() => '?').join(',');
      
      console.log(`查询监控项详情, IDs: ${monitorIds}, SQL占位符: ${placeholders}`);
      
      if (monitorIds.length > 0) {
        const monitorsResult = await c.env.DB.prepare(
          `SELECT * FROM monitors WHERE id IN (${placeholders})`
        ).bind(...monitorIds).all<Monitor>();
        
        console.log('监控项查询结果:', JSON.stringify(monitorsResult));
        
        if (monitorsResult.results) {
          // 获取每个监控的历史记录
          monitors = await Promise.all(monitorsResult.results.map(async (monitor) => {
            const historyResult = await c.env.DB.prepare(
              `SELECT status, timestamp 
               FROM monitor_status_history 
               WHERE monitor_id = ? 
               ORDER BY timestamp DESC 
               LIMIT 24`
            ).bind(monitor.id).all<{status: string, timestamp: string}>();
            
            // 将历史记录转换为状态数组
            const history = historyResult.results 
              ? historyResult.results.map(h => h.status)
              : Array(24).fill('unknown');
              
            return {
              ...monitor,
              history
            };
          }));
        }
      }
    } else {
      console.log('没有配置的监控项，返回空列表');
    }
    
    // 获取客户端详细信息
    let agents: Agent[] = [];
    if (selectedAgents.results && selectedAgents.results.length > 0) {
      const agentIds = selectedAgents.results.map(a => a.agent_id);
      const placeholders = agentIds.map(() => '?').join(',');
      
      console.log(`查询客户端详情, IDs: ${agentIds}, SQL占位符: ${placeholders}`);
      
      if (agentIds.length > 0) {
        const agentsResult = await c.env.DB.prepare(
          `SELECT * FROM agents WHERE id IN (${placeholders})`
        ).bind(...agentIds).all<Agent>();
        
        console.log('客户端查询结果:', JSON.stringify(agentsResult));
        
        if (agentsResult.results) {
          agents = agentsResult.results;
        }
      }
    } else {
      // 修改: 不再自动获取所有客户端并关联
      console.log('没有配置的客户端，返回空列表');
      // 这里不再获取所有活跃客户端和自动关联
    }
    
    // 构建并返回响应
    console.log('返回状态页数据:', {
      monitors: monitors.length,
      agents: agents.length
    });
    
    // 为监控项添加必要的字段
    const enrichedMonitors = monitors.map((monitor: any) => ({
      ...monitor,
      status: monitor.status || 'unknown',
      uptime: monitor.uptime || 0,
      response_time: monitor.response_time || 0,
      history: monitor.history || Array(24).fill('unknown')
    }));
    
    // 为客户端添加资源使用情况字段
    const enrichedAgents = agents.map((agent: any) => {
      // 计算内存使用百分比 (如果有总量和使用量)
      const memoryPercent = agent.memory_total && agent.memory_used
        ? (agent.memory_used / agent.memory_total) * 100
        : null;
        
      // 计算磁盘使用百分比 (如果有总量和使用量)
      const diskPercent = agent.disk_total && agent.disk_used
        ? (agent.disk_used / agent.disk_total) * 100
        : null;
        
      return {
        ...agent,
        // 使用数据库中的 status 字段，不重新计算
        cpu: agent.cpu_usage || 0,               // 使用数据库中的CPU使用率
        memory: memoryPercent || 0,              // 使用数据库中的内存使用百分比
        disk: diskPercent || 0,                  // 使用数据库中的磁盘使用百分比
        network_rx: agent.network_rx || 0,
        network_tx: agent.network_tx || 0,
        hostname: agent.hostname || "未知主机",
        ip_address: agent.ip_address || "0.0.0.0",
        os: agent.os || "未知系统",
        version: agent.version || "未知版本",
        cpu_arch: agent.cpu_arch || null,
        cpu_model_name: agent.cpu_model_name || null,
        cpu_cores: agent.cpu_cores || null,
        load1: agent.load1 ?? null,
        load5: agent.load5 ?? null,
        load15: agent.load15 ?? null,
        boot_time: agent.boot_time || null,
        network_rx_total: agent.network_rx_total || 0,
        network_tx_total: agent.network_tx_total || 0,
        agent_version: agent.agent_version || null,
        country: agent.country || null,
        connected_at: agent.connected_at || null
      };
    });
    
    return c.json({
      success: true,
      data: {
        title: config.title,
        description: config.description,
        logoUrl: config.logo_url,
        customCss: config.custom_css,
        monitors: enrichedMonitors,
        agents: enrichedAgents.map(agent => ({
          id: agent.id,
          name: agent.name,
          status: agent.status,
          cpu: agent.cpu,
          memory: agent.memory,
          disk: agent.disk,
          network_rx: agent.network_rx,
          network_tx: agent.network_tx,
          hostname: agent.hostname,
          ip_address: agent.ip_address,
          os: agent.os,
          version: agent.version,
          cpu_arch: agent.cpu_arch,
          cpu_model_name: agent.cpu_model_name,
          cpu_cores: agent.cpu_cores,
          load1: agent.load1,
          load5: agent.load5,
          load15: agent.load15,
          boot_time: agent.boot_time,
          network_rx_total: agent.network_rx_total,
          network_tx_total: agent.network_tx_total,
          agent_version: agent.agent_version,
          cpu_usage: agent.cpu_usage,
          memory_total: agent.memory_total,
          memory_used: agent.memory_used,
          disk_total: agent.disk_total,
          disk_used: agent.disk_used,
          country: agent.country,
          connected_at: agent.connected_at
        }))
      }
    });
  } catch (error) {
    console.error('获取状态页数据失败:', error);
    return c.json({ success: false, message: '获取状态页数据失败', error: String(error) }, 500);
  }
});

// 创建默认配置
async function createDefaultConfig(c: any) {
  try {
    console.log('创建默认状态页配置');
    
    // 查找管理员账户
    const admin = await c.env.DB.prepare(
      'SELECT id FROM users WHERE role = ?'
    ).bind('admin').first();
    
    if (!admin) {
      console.log('未找到管理员账户');
      return null;
    }
    
    // 创建默认配置
    const insertResult = await c.env.DB.prepare(
      'INSERT INTO status_page_config (user_id, title, description, logo_url, custom_css) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      admin.id,
      '系统状态',
      '实时监控系统状态',
      '',
      ''
    ).run();
    
    if (!insertResult.success) {
      console.log('创建默认配置失败');
      return null;
    }
    
    // 获取新插入的ID
    const lastInsertId = await c.env.DB.prepare('SELECT last_insert_rowid() as id').first();
    if (!lastInsertId || typeof lastInsertId.id !== 'number') {
      console.log('获取配置ID失败');
      return null;
    }
    
    const configId = lastInsertId.id;
    console.log(`创建的默认配置ID: ${configId}`);
    
    // 获取所有监控项目
    let monitors;
    try {
      // 获取监控项
      monitors = await c.env.DB.prepare(
        'SELECT * FROM monitors WHERE active = 1'
      ).all();
    } catch (error) {
      console.error('获取监控项失败:', error);
      monitors = { results: [] };
    }
    
    // 获取所有客户端
    let agents;
    try {
      // 获取所有客户端
      agents = await c.env.DB.prepare(
        'SELECT * FROM agents'
      ).all();
    } catch (error) {
      console.error('获取客户端失败:', error);
      agents = { results: [] };
    }
    
    // 关联监控项
    if (monitors.results && monitors.results.length > 0) {
      console.log(`找到 ${monitors.results.length} 个活跃监控项`);
      for (const monitor of monitors.results) {
        await c.env.DB.prepare(
          'INSERT INTO status_page_monitors (config_id, monitor_id) VALUES (?, ?)'
        ).bind(configId, monitor.id).run();
      }
    }
    
    // 关联客户端
    if (agents.results && agents.results.length > 0) {
      console.log(`找到 ${agents.results.length} 个活跃客户端`);
      for (const agent of agents.results) {
        await c.env.DB.prepare(
          'INSERT INTO status_page_agents (config_id, agent_id) VALUES (?, ?)'
        ).bind(configId, agent.id).run();
      }
    }
    
    // 返回创建的配置
    return {
      title: '系统状态',
      description: '实时监控系统状态',
      logoUrl: '',
      customCss: '',
      monitors: monitors.results ? monitors.results.map((monitor: any) => ({
        ...monitor,
        status: monitor.status || 'unknown',
        uptime: monitor.uptime || 0,
        response_time: monitor.response_time || 0,
        history: Array(24).fill('unknown')
      })) : [],
      agents: agents.results ? agents.results.map((agent: any) => {
        // 计算内存使用百分比 (如果有总量和使用量)
        const memoryPercent = agent.memory_total && agent.memory_used
          ? (agent.memory_used / agent.memory_total) * 100
          : null;
          
        // 计算磁盘使用百分比 (如果有总量和使用量)
        const diskPercent = agent.disk_total && agent.disk_used
          ? (agent.disk_used / agent.disk_total) * 100
          : null;
          
        return {
          ...agent,
          // 使用数据库中的 status 字段，不重新计算
          cpu: agent.cpu_usage || 0,               // 使用数据库中的CPU使用率
          memory: memoryPercent || 0,              // 使用数据库中的内存使用百分比
          disk: diskPercent || 0,                  // 使用数据库中的磁盘使用百分比
          network_rx: agent.network_rx || 0,       // 使用数据库中的网络下载速率
          network_tx: agent.network_tx || 0,       // 使用数据库中的网络上传速率
          hostname: agent.hostname || "未知主机",
          ip_address: agent.ip_address || "0.0.0.0",
          os: agent.os || "未知系统",
          version: agent.version || "未知版本"
        };
      }) : []
    };
  } catch (error) {
    console.error('创建默认配置失败:', error);
    return null;
  }
}

// 注册管理员路由
app.route('/', adminRoutes);

export default app; 