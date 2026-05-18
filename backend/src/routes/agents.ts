import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { Context, Next } from 'hono';
import { Bindings } from '../models/db';
import { Agent } from '../models/agent';
import { getJwtSecret, generateToken, toD1Primitive } from '../utils/jwt';

const agents = new Hono<{ Bindings: Bindings; Variables: { agent: Agent; jwtPayload: any } }>();

// 中间件：JWT 认证
agents.use('*', async (c, next) => {
  // 跳过特定路由的认证 (客户端上报指标接口和注册接口)
  if ((c.req.path.endsWith('/status') || c.req.path.endsWith('/register')) && c.req.method === 'POST') {
    return next();
  }
  
  const jwtMiddleware = jwt({ alg: "HS256", 
    secret: getJwtSecret(c)
  });
  return jwtMiddleware(c, next);
});

// 获取所有客户端
agents.get('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    
    // 根据用户角色过滤客户端
    let result;
    if (payload.role === 'admin') {
      result = await c.env.DB.prepare(
        'SELECT * FROM agents ORDER BY created_at DESC'
      ).all<Agent>();
    } else {
      result = await c.env.DB.prepare(
        'SELECT * FROM agents WHERE created_by = ? ORDER BY created_at DESC'
      ).bind(payload.id).all<Agent>();
    }
    
    const agents = (result.results || []).map(({ token, ...rest }: any) => rest);
    return c.json({ success: true, agents });
  } catch (error) {
    console.error('获取客户端列表错误:', error);
    return c.json({ 
      success: false, 
      message: '获取客户端列表失败',
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 创建新客户端
agents.post('/', async (c) => {
  try {
    const { name, token: reqToken, category, tags } = await c.req.json();
    const payload = c.get('jwtPayload');
    
    const token = reqToken || await generateToken();
    const now = new Date().toISOString();
    
    // 插入新客户端
    const result = await c.env.DB.prepare(
      `INSERT INTO agents
       (name, token, created_by, status, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      name,
      token,
      payload.id,
      'inactive',
      category || null,
      now,
      now
    ).run();
    
    if (!result.success) {
      throw new Error('创建客户端失败');
    }
    
    // 获取新创建的客户端
    const newAgent = await c.env.DB.prepare(
      'SELECT * FROM agents WHERE rowid = last_insert_rowid()'
    ).first<Agent>();
    
    return c.json({ 
      success: true, 
      message: '客户端创建成功',
      agent: newAgent // 创建时返回完整信息，包括令牌
    }, 201);
  } catch (error) {
    console.error('创建客户端错误:', error);
    return c.json({ success: false, message: '创建客户端失败' }, 500);
  }
});

// 获取单个客户端
agents.get('/:id', async (c) => {
  try {
    const agentId = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 获取客户端信息
    const agent = await c.env.DB.prepare(
      `SELECT * FROM agents WHERE id = ?`
    ).bind(agentId).first<Agent>();
    
    if (!agent) {
      return c.json({ success: false, message: '客户端不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && agent.created_by !== payload.id) {
      return c.json({ success: false, message: '无权访问此客户端' }, 403);
    }
    
    return c.json({
      success: true,
      agent: {
        ...agent,
        cpu_usage: agent.cpu_usage || 0,
        memory_total: agent.memory_total || 0,
        memory_used: agent.memory_used || 0,
        disk_total: agent.disk_total || 0,
        disk_used: agent.disk_used || 0,
        network_rx: agent.network_rx || 0,
        network_tx: agent.network_tx || 0,
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
        connected_at: agent.connected_at || null,
        traffic_limit: agent.traffic_limit || null,
        expiry_time: agent.expiry_time || null,
        category: agent.category || null,
        tags: agent.tags || null
      }
    });
  } catch (error) {
    console.error('获取客户端详情错误:', error);
    return c.json({ success: false, message: '获取客户端详情失败' }, 500);
  }
});

// 更新客户端信息
agents.put('/:id', async (c) => {
  try {
    const agentId = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 获取当前客户端数据
    const agent = await c.env.DB.prepare(
      'SELECT * FROM agents WHERE id = ?'
    ).bind(agentId).first<Agent>();
    
    if (!agent) {
      return c.json({ success: false, message: '客户端不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && agent.created_by !== payload.id) {
      return c.json({ success: false, message: '无权修改此客户端' }, 403);
    }
    
    // 获取更新数据
    const updateData = await c.req.json();
    const { name, hostname, ip_address, os, version, status, traffic_limit, expiry_time, category, tags } = updateData;
    
    // 准备更新的字段和值
    const fieldsToUpdate = [];
    const values = [];
    
    if (name !== undefined) {
      fieldsToUpdate.push('name = ?');
      values.push(name);
    }
    
    if (hostname !== undefined) {
      fieldsToUpdate.push('hostname = ?');
      values.push(hostname);
    }
    
    if (ip_address !== undefined) {
      fieldsToUpdate.push('ip_address = ?');
      values.push(ip_address);
    }
    
    if (os !== undefined) {
      fieldsToUpdate.push('os = ?');
      values.push(os);
    }
    
    if (version !== undefined) {
      fieldsToUpdate.push('version = ?');
      values.push(version);
    }
    
    if (status !== undefined) {
      fieldsToUpdate.push('status = ?');
      values.push(status);
    }

    if (traffic_limit !== undefined) {
      fieldsToUpdate.push('traffic_limit = ?');
      values.push(traffic_limit);
    }

    if (expiry_time !== undefined) {
      fieldsToUpdate.push('expiry_time = ?');
      values.push(expiry_time);
    }

    if (category !== undefined) {
      fieldsToUpdate.push('category = ?');
      values.push(category);
    }

    if (tags !== undefined) {
      fieldsToUpdate.push('tags = ?');
      values.push(tags);
    }

    fieldsToUpdate.push('updated_at = ?');
    values.push(new Date().toISOString());
    
    // 添加客户端ID作为最后一个参数
    values.push(agentId);
    
    // 如果没有要更新的字段，直接返回
    if (fieldsToUpdate.length === 1) { // 只有updated_at
      return c.json({ 
        success: true, 
        message: '没有更新任何字段', 
        agent
      });
    }
    
    // 执行更新
    const updateSql = `
      UPDATE agents 
      SET ${fieldsToUpdate.join(', ')} 
      WHERE id = ?
    `;
    
    const result = await c.env.DB.prepare(updateSql).bind(...values).run();
    
    if (!result.success) {
      throw new Error('更新客户端失败');
    }
    
    // 获取更新后的客户端数据
    const updatedAgent = await c.env.DB.prepare(
      'SELECT * FROM agents WHERE id = ?'
    ).bind(agentId).first<Agent>();
    
    return c.json({ 
      success: true, 
      message: '客户端信息已更新',
      agent: updatedAgent
    });
  } catch (error) {
    console.error('更新客户端错误:', error);
    return c.json({ success: false, message: '更新客户端失败' }, 500);
  }
});

// 更新客户端状态
agents.post('/:id/status', async (c) => {
  try {
    const agentId = Number(c.req.param('id'));
    const { 
      cpu_usage, 
      memory_total, 
      memory_used, 
      disk_total, 
      disk_used, 
      network_rx, 
      network_tx,
      hostname,
      ip_address,
      os,
      version
    } = await c.req.json();
    
    // 更新客户端状态和资源指标
    const result = await c.env.DB.prepare(
      `UPDATE agents SET 
       status = 'active',
       cpu_usage = ?, 
       memory_total = ?, 
       memory_used = ?, 
       disk_total = ?, 
       disk_used = ?, 
       network_rx = ?, 
       network_tx = ?, 
       hostname = ?,
       ip_address = ?,
       os = ?,
       version = ?,
       updated_at = ?
       WHERE id = ?`
    ).bind(
      cpu_usage,
      memory_total,
      memory_used,
      disk_total,
      disk_used,
      network_rx,
      network_tx,
      hostname,
      ip_address,
      os,
      version,
      new Date().toISOString(),
      agentId
    ).run();
    
    if (!result.success) {
      throw new Error('更新客户端状态失败');
    }
    
    return c.json({ 
      success: true, 
      message: '客户端状态已更新'
    });
  } catch (error) {
    console.error('更新客户端状态错误:', error);
    return c.json({ success: false, message: '更新客户端状态失败' }, 500);
  }
});

// 删除客户端
agents.delete('/:id', async (c) => {
  try {
    const agentId = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 获取客户端信息
    const agent = await c.env.DB.prepare(
      'SELECT * FROM agents WHERE id = ?'
    ).bind(agentId).first<Agent>();
    
    if (!agent) {
      return c.json({ success: false, message: '客户端不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && agent.created_by !== payload.id) {
      return c.json({ success: false, message: '无权删除此客户端' }, 403);
    }
    
    // 执行删除客户端
    const result = await c.env.DB.prepare(
      'DELETE FROM agents WHERE id = ?'
    ).bind(agent.id).run();
    
    if (!result.success) {
      throw new Error('删除客户端失败');
    }
    
    return c.json({ 
      success: true, 
      message: '客户端已删除'
    });
  } catch (error) {
    console.error('删除客户端错误:', error);
    return c.json({ success: false, message: '删除客户端失败' }, 500);
  }
});

// 重新生成客户端令牌
agents.post('/:id/token', async (c) => {
  try {
    const agentId = Number(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 获取客户端信息
    const agent = await c.env.DB.prepare(
      'SELECT * FROM agents WHERE id = ?'
    ).bind(agentId).first<Agent>();
    
    if (!agent) {
      return c.json({ success: false, message: '客户端不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && agent.created_by !== payload.id) {
      return c.json({ success: false, message: '无权为此客户端重新生成令牌' }, 403);
    }
    
    // 生成新令牌
    const newToken = await generateToken();
    
    // 更新客户端令牌
    const result = await c.env.DB.prepare(
      'UPDATE agents SET token = ?, updated_at = ? WHERE id = ?'
    ).bind(
      newToken,
      new Date().toISOString(),
      agent.id
    ).run();
    
    if (!result.success) {
      throw new Error('更新客户端令牌失败');
    }
    
    return c.json({ 
      success: true, 
      message: '客户端令牌已重新生成',
      token: newToken
    });
  } catch (error) {
    console.error('重新生成客户端令牌错误:', error);
    return c.json({ success: false, message: '重新生成客户端令牌失败' }, 500);
  }
});

// 生成临时注册Token
agents.post('/token/generate', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    
    // 生成新令牌
    const newToken = await generateToken();
    
    // 可以选择将此token存储在临时表中，或者使用其他方式验证(例如，设置过期时间)
    // 这里为简化操作，只返回令牌

    return c.json({ 
      success: true, 
      message: '已生成客户端注册令牌',
      token: newToken
    });
  } catch (error) {
    console.error('生成注册令牌错误:', error);
    return c.json({ success: false, message: '生成注册令牌失败' }, 500);
  }
});

// 客户端自注册接口
agents.post('/register', async (c) => {
  try {
    const { token, name, hostname, ip_address, os, version } = await c.req.json();
    
    if (!token) {
      return c.json({ success: false, message: '缺少注册令牌' }, 400);
    }
    
    // 查找管理员用户作为客户端创建者
    const adminUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE role = ?'
    ).bind('admin').first<{id: number}>();
    
    if (!adminUser) {
      return c.json({ success: false, message: '无法找到管理员用户' }, 500);
    }
    
    const now = new Date().toISOString();
    
    // 按 token 匹配
    const existingAgent = await c.env.DB.prepare(
      'SELECT id FROM agents WHERE token = ?'
    ).bind(token).first<{id: number}>();

    if (existingAgent) {
      // 更新已有客户端（含 token，同 hostname 时迁移 token）
      const updateResult = await c.env.DB.prepare(
        `UPDATE agents SET
         status = 'active',
         hostname = ?,
         ip_address = ?,
         os = ?,
         version = ?,
         token = ?,
         updated_at = ?
         WHERE id = ?`
      ).bind(
        hostname || null,
        ip_address || null,
        os || null,
        version || null,
        token,
        new Date().toISOString(),
        existingAgent.id
      ).run();

      if (!updateResult.success) {
        throw new Error('更新客户端信息失败');
      }

      return c.json({
        success: true,
        message: '客户端状态更新成功',
        agent: existingAgent
      });
    }

    // token 未匹配，拒绝注册（需先在 Web 界面创建客户端获取 token）
    return c.json({
      success: false,
      message: '客户端未注册，请先在 Web 界面添加客户端并使用生成的 Token'
    }, 404);
  } catch (error) {
    console.error('客户端注册错误:', error);
    return c.json({ 
      success: false, 
      message: '客户端注册失败',
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 通过令牌更新客户端状态
agents.post('/status', async (c) => {
  try {
    const { 
      token,
      cpu_usage, 
      memory_total, 
      memory_used, 
      disk_total, 
      disk_used, 
      network_rx, 
      network_tx,
      hostname,
      ip_address,
      os,
      version
    } = await c.req.json();
    
    if (!token) {
      return c.json({ success: false, message: '缺少API令牌' }, 400);
    }
    
    // 通过token查找客户端
    const agent = await c.env.DB.prepare(
      'SELECT id FROM agents WHERE token = ?'
    ).bind(token).first<{id: number}>();
    
    if (!agent) {
      return c.json({ success: false, message: '客户端不存在或令牌无效' }, 404);
    }
    
    // 更新客户端状态和资源指标
    const result = await c.env.DB.prepare(
      `UPDATE agents SET 
       status = 'active',
       cpu_usage = ?, 
       memory_total = ?, 
       memory_used = ?, 
       disk_total = ?, 
       disk_used = ?, 
       network_rx = ?, 
       network_tx = ?, 
       hostname = ?,
       ip_address = ?,
       os = ?,
       version = ?,
       updated_at = ?
       WHERE id = ?`
    ).bind(
      cpu_usage,
      memory_total,
      memory_used,
      disk_total,
      disk_used,
      network_rx,
      network_tx,
      toD1Primitive(hostname),
      toD1Primitive(ip_address),
      toD1Primitive(os),
      toD1Primitive(version),
      new Date().toISOString(),
      agent.id
    ).run();

    if (!result.success) {
      throw new Error('更新客户端状态失败');
    }

    return c.json({
      success: true,
      message: '客户端状态已更新'
    });
  } catch (error) {
    console.error('更新客户端状态错误:', error);
    return c.json({ success: false, message: '更新客户端状态失败' }, 500);
  }
});

export default agents; 