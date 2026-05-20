import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { Context, Next } from 'hono';
import { Bindings } from '../models/db';
import { Agent } from '../models/agent';
import { getJwtSecret, generateToken, generateAgentName, toD1Primitive, addDuration } from '../utils/jwt';

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
    
    const agents = (result.results || []).map((a: any) => {
      if (payload.role !== 'admin') { const { token, ...rest } = a; return rest; }
      return a;
    });
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
    const { name, token: reqToken, category, tags, public: isPublic, expiry_time, traffic_limit, start_time, duration_value, duration_unit } = await c.req.json();
    const payload = c.get('jwtPayload');

    const token = reqToken || await generateToken();
    const now = new Date().toISOString();

    // 计算 expiry_time: 优先使用直接传入的，否则根据 start_time + duration 计算
    let computedExpiry = expiry_time || null;
    if (!computedExpiry && start_time && duration_value && duration_unit) {
      computedExpiry = addDuration(new Date(start_time), duration_value, duration_unit).toISOString();
    }

    // 插入新客户端
    const result = await c.env.DB.prepare(
      `INSERT INTO agents
       (name, token, created_by, status, category, tags, public, expiry_time, start_time, duration_value, duration_unit, traffic_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      name,
      token,
      payload.id,
      'inactive',
      category || null,
      tags || null,
      isPublic !== undefined ? (isPublic ? 1 : 0) : 1,
      computedExpiry,
      start_time || null,
      duration_value || null,
      duration_unit || null,
      traffic_limit || null,
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

// 获取所有标签（标签池）
agents.get('/tags/pool', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    let result;
    if (payload.role === 'admin') {
      result = await c.env.DB.prepare(
        "SELECT tags FROM agents WHERE tags IS NOT NULL AND tags != ''"
      ).all<{ tags: string }>();
    } else {
      result = await c.env.DB.prepare(
        "SELECT tags FROM agents WHERE created_by = ? AND tags IS NOT NULL AND tags != ''"
      ).bind(payload.id).all<{ tags: string }>();
    }

    const tagSet = new Set<string>();
    for (const row of result.results || []) {
      row.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
    }

    return c.json({ success: true, tags: Array.from(tagSet).sort() });
  } catch (error) {
    console.error('获取标签池错误:', error);
    return c.json({ success: false, message: '获取标签池失败' }, 500);
  }
});

// 分组管理 — 获取所有分组
agents.get('/groups', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT * FROM agent_groups ORDER BY name ASC').all<{id: number; name: string; created_at: string}>();
    return c.json({ success: true, groups: result.results || [] });
  } catch (e: any) {
    return c.json({ success: false, message: '获取分组失败' }, 500);
  }
});

// 分组管理 — 新增分组
agents.post('/groups', async (c) => {
  try {
    const { name } = await c.req.json();
    if (!name?.trim()) return c.json({ success: false, message: '分组名不能为空' }, 400);
    const now = new Date().toISOString();
    await c.env.DB.prepare('INSERT INTO agent_groups (name, created_at) VALUES (?, ?)').bind(name.trim(), now).run();
    return c.json({ success: true, message: '分组已添加' }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return c.json({ success: false, message: '分组名已存在' }, 409);
    return c.json({ success: false, message: '添加分组失败' }, 500);
  }
});

// 分组管理 — 删除分组
agents.delete('/groups/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    const result = await c.env.DB.prepare('DELETE FROM agent_groups WHERE id = ?').bind(id).run();
    if (!result.success) throw new Error('删除失败');
    return c.json({ success: true, message: '分组已删除' });
  } catch (e: any) {
    return c.json({ success: false, message: '删除分组失败' }, 500);
  }
});

// 分组池（供前端 autocomplete 使用）
agents.get('/groups/pool', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT name FROM agent_groups ORDER BY name ASC').all<{name: string}>();
    const names = (result.results || []).map(r => r.name);
    return c.json({ success: true, groups: names });
  } catch {
    return c.json({ success: false, message: '获取分组池失败' }, 500);
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
        start_time: agent.start_time || null,
        duration_value: agent.duration_value || null,
        duration_unit: agent.duration_unit || null,
        category: agent.category || null,
        tags: agent.tags || null,
        public: agent.public ?? 1
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
    const { name, hostname, ip_address, os, version, status, traffic_limit, expiry_time, start_time, duration_value, duration_unit, category, tags, public: isPublic } = updateData;
    
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

    if (start_time !== undefined) {
      fieldsToUpdate.push('start_time = ?');
      values.push(start_time);
    }

    if (duration_value !== undefined) {
      fieldsToUpdate.push('duration_value = ?');
      values.push(duration_value);
    }

    if (duration_unit !== undefined) {
      fieldsToUpdate.push('duration_unit = ?');
      values.push(duration_unit);
    }

    // 如果提供了 start_time + duration，重新计算 expiry_time
    if (start_time !== undefined || duration_value !== undefined || duration_unit !== undefined) {
      const st = start_time !== undefined ? start_time : agent.start_time;
      const dv = duration_value !== undefined ? duration_value : agent.duration_value;
      const du = duration_unit !== undefined ? duration_unit : agent.duration_unit;
      if (st && dv && du) {
        const recomputedExpiry = addDuration(new Date(st), dv, du).toISOString();
        // 如果 expiry_time 没有被显式传入，则用计算值覆盖
        if (expiry_time === undefined) {
          fieldsToUpdate.push('expiry_time = ?');
          values.push(recomputedExpiry);
        }
      }
    }

    if (category !== undefined) {
      fieldsToUpdate.push('category = ?');
      values.push(category);
    }

    if (tags !== undefined) {
      fieldsToUpdate.push('tags = ?');
      values.push(tags);
    }

    if (isPublic !== undefined) {
      fieldsToUpdate.push('public = ?');
      values.push(isPublic ? 1 : 0);
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

    // 自动续期：如果 agent 在线且已过期，自动延长有效期
    const agentForRenew = await c.env.DB.prepare(
      'SELECT expiry_time, duration_value, duration_unit FROM agents WHERE id = ?'
    ).bind(agentId).first<{expiry_time: string | null; duration_value: number | null; duration_unit: string | null}>();
    if (agentForRenew?.expiry_time && agentForRenew?.duration_value && agentForRenew?.duration_unit) {
      const now = new Date();
      if (now > new Date(agentForRenew.expiry_time)) {
        const newExpiry = addDuration(now, agentForRenew.duration_value, agentForRenew.duration_unit);
        await c.env.DB.prepare(
          'UPDATE agents SET start_time = ?, expiry_time = ? WHERE id = ?'
        ).bind(now.toISOString(), newExpiry.toISOString(), agentId).run();
      }
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

    // token 未匹配，使用客户端发来的 token 自动创建
    const autoName = generateAgentName(null);
    const insertResult = await c.env.DB.prepare(
      `INSERT INTO agents (name, token, created_by, status, hostname, ip_address, os, version, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`
    ).bind(autoName, token, adminUser.id, hostname || null, ip_address || null, os || null, version || null, now, now).run();

    if (!insertResult.success) {
      throw new Error('自动创建客户端失败');
    }

    const created = await c.env.DB.prepare('SELECT * FROM agents WHERE rowid = last_insert_rowid()').first<Agent>();
    return c.json({
      success: true,
      message: '客户端自动注册成功',
      agent: created,
      token: token
    }, 201);
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

    // 自动续期：如果 agent 在线且已过期，自动延长有效期
    const agentForRenew = await c.env.DB.prepare(
      'SELECT expiry_time, duration_value, duration_unit FROM agents WHERE id = ?'
    ).bind(agent.id).first<{expiry_time: string | null; duration_value: number | null; duration_unit: string | null}>();
    if (agentForRenew?.expiry_time && agentForRenew?.duration_value && agentForRenew?.duration_unit) {
      const now = new Date();
      if (now > new Date(agentForRenew.expiry_time)) {
        const newExpiry = addDuration(now, agentForRenew.duration_value, agentForRenew.duration_unit);
        await c.env.DB.prepare(
          'UPDATE agents SET start_time = ?, expiry_time = ? WHERE id = ?'
        ).bind(now.toISOString(), newExpiry.toISOString(), agent.id).run();
      }
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