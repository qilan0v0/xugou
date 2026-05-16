"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const jwt_1 = require("hono/jwt");
const jwt_2 = require("../utils/jwt");
const agents = new hono_1.Hono();
// 中间件：JWT 认证
agents.use('*', async (c, next) => {
    // 跳过特定路由的认证 (客户端上报指标接口和注册接口)
    if ((c.req.path.endsWith('/status') || c.req.path.endsWith('/register')) && c.req.method === 'POST') {
        return next();
    }
    const jwtMiddleware = (0, jwt_1.jwt)({
        secret: (0, jwt_2.getJwtSecret)(c)
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
            result = await c.env.DB.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
        }
        else {
            result = await c.env.DB.prepare('SELECT * FROM agents WHERE created_by = ? ORDER BY created_at DESC').bind(payload.id).all();
        }
        return c.json({ success: true, agents: result.results || [] });
    }
    catch (error) {
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
        const { name, token: reqToken } = await c.req.json();
        const payload = c.get('jwtPayload');
        const token = reqToken || await (0, jwt_2.generateToken)();
        const now = new Date().toISOString();
        // 插入新客户端
        const result = await c.env.DB.prepare(`INSERT INTO agents 
       (name, token, created_by, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?)`).bind(name, token, payload.id, 'inactive', now, now).run();
        if (!result.success) {
            throw new Error('创建客户端失败');
        }
        // 获取新创建的客户端
        const newAgent = await c.env.DB.prepare('SELECT * FROM agents WHERE rowid = last_insert_rowid()').first();
        return c.json({
            success: true,
            message: '客户端创建成功',
            agent: newAgent // 创建时返回完整信息，包括令牌
        }, 201);
    }
    catch (error) {
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
        const agent = await c.env.DB.prepare(`SELECT * FROM agents WHERE id = ?`).bind(agentId).first();
        if (!agent) {
            return c.json({ success: false, message: '客户端不存在' }, 404);
        }
        // 检查权限
        if (payload.role !== 'admin' && agent.created_by !== payload.id) {
            return c.json({ success: false, message: '无权访问此客户端' }, 403);
        }
        // 不返回令牌，但保留其他所有字段
        const { token, ...rest } = agent;
        return c.json({
            success: true,
            agent: {
                ...rest,
                cpu_usage: rest.cpu_usage || 0,
                memory_total: rest.memory_total || 0,
                memory_used: rest.memory_used || 0,
                disk_total: rest.disk_total || 0,
                disk_used: rest.disk_used || 0,
                network_rx: rest.network_rx || 0,
                network_tx: rest.network_tx || 0,
                cpu_arch: rest.cpu_arch || null,
                cpu_model_name: rest.cpu_model_name || null,
                cpu_cores: rest.cpu_cores || null,
                load1: rest.load1 ?? null,
                load5: rest.load5 ?? null,
                load15: rest.load15 ?? null,
                boot_time: rest.boot_time || null,
                network_rx_total: rest.network_rx_total || 0,
                network_tx_total: rest.network_tx_total || 0,
                agent_version: rest.agent_version || null,
                country: rest.country || null,
                connected_at: rest.connected_at || null
            }
        });
    }
    catch (error) {
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
        const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agentId).first();
        if (!agent) {
            return c.json({ success: false, message: '客户端不存在' }, 404);
        }
        // 检查权限
        if (payload.role !== 'admin' && agent.created_by !== payload.id) {
            return c.json({ success: false, message: '无权修改此客户端' }, 403);
        }
        // 获取更新数据
        const updateData = await c.req.json();
        const { name, hostname, ip_address, os, version, status } = updateData;
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
        const updatedAgent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agentId).first();
        return c.json({
            success: true,
            message: '客户端信息已更新',
            agent: updatedAgent
        });
    }
    catch (error) {
        console.error('更新客户端错误:', error);
        return c.json({ success: false, message: '更新客户端失败' }, 500);
    }
});
// 更新客户端状态
agents.post('/:id/status', async (c) => {
    try {
        const agentId = Number(c.req.param('id'));
        const { cpu_usage, memory_total, memory_used, disk_total, disk_used, network_rx, network_tx, hostname, ip_address, os, version } = await c.req.json();
        // 更新客户端状态和资源指标
        const result = await c.env.DB.prepare(`UPDATE agents SET 
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
       WHERE id = ?`).bind(cpu_usage, memory_total, memory_used, disk_total, disk_used, network_rx, network_tx, hostname, ip_address, os, version, new Date().toISOString(), agentId).run();
        if (!result.success) {
            throw new Error('更新客户端状态失败');
        }
        return c.json({
            success: true,
            message: '客户端状态已更新'
        });
    }
    catch (error) {
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
        const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agentId).first();
        if (!agent) {
            return c.json({ success: false, message: '客户端不存在' }, 404);
        }
        // 检查权限
        if (payload.role !== 'admin' && agent.created_by !== payload.id) {
            return c.json({ success: false, message: '无权删除此客户端' }, 403);
        }
        // 执行删除客户端
        const result = await c.env.DB.prepare('DELETE FROM agents WHERE id = ?').bind(agent.id).run();
        if (!result.success) {
            throw new Error('删除客户端失败');
        }
        return c.json({
            success: true,
            message: '客户端已删除'
        });
    }
    catch (error) {
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
        const agent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agentId).first();
        if (!agent) {
            return c.json({ success: false, message: '客户端不存在' }, 404);
        }
        // 检查权限
        if (payload.role !== 'admin' && agent.created_by !== payload.id) {
            return c.json({ success: false, message: '无权为此客户端重新生成令牌' }, 403);
        }
        // 生成新令牌
        const newToken = await (0, jwt_2.generateToken)();
        // 更新客户端令牌
        const result = await c.env.DB.prepare('UPDATE agents SET token = ?, updated_at = ? WHERE id = ?').bind(newToken, new Date().toISOString(), agent.id).run();
        if (!result.success) {
            throw new Error('更新客户端令牌失败');
        }
        return c.json({
            success: true,
            message: '客户端令牌已重新生成',
            token: newToken
        });
    }
    catch (error) {
        console.error('重新生成客户端令牌错误:', error);
        return c.json({ success: false, message: '重新生成客户端令牌失败' }, 500);
    }
});
// 生成临时注册Token
agents.post('/token/generate', async (c) => {
    try {
        const payload = c.get('jwtPayload');
        // 生成新令牌
        const newToken = await (0, jwt_2.generateToken)();
        // 可以选择将此token存储在临时表中，或者使用其他方式验证(例如，设置过期时间)
        // 这里为简化操作，只返回令牌
        return c.json({
            success: true,
            message: '已生成客户端注册令牌',
            token: newToken
        });
    }
    catch (error) {
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
        const adminUser = await c.env.DB.prepare('SELECT id FROM users WHERE role = ?').bind('admin').first();
        if (!adminUser) {
            return c.json({ success: false, message: '无法找到管理员用户' }, 500);
        }
        const now = new Date().toISOString();
        // 1. 先按 token 匹配
        let existingAgent = await c.env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first();
        // 2. token 未匹配，按 hostname 匹配（复用同机器最近活跃的记录）
        if (!existingAgent && hostname) {
            existingAgent = await c.env.DB.prepare('SELECT id FROM agents WHERE hostname = ? ORDER BY updated_at DESC LIMIT 1').bind(hostname).first();
        }
        if (existingAgent) {
            // 更新已有客户端（含 token，同 hostname 时迁移 token）
            const updateResult = await c.env.DB.prepare(`UPDATE agents SET
         status = 'active',
         hostname = ?,
         ip_address = ?,
         os = ?,
         version = ?,
         token = ?,
         updated_at = ?
         WHERE id = ?`).bind(hostname || null, ip_address || null, os || null, version || null, token, new Date().toISOString(), existingAgent.id).run();
            if (!updateResult.success) {
                throw new Error('更新客户端信息失败');
            }
            return c.json({
                success: true,
                message: '客户端状态更新成功',
                agent: existingAgent
            });
        }
        // 3. token 和 hostname 都未匹配，拒绝自动注册
        return c.json({
            success: false,
            message: '客户端未找到，请先在 Web 界面创建客户端并使用生成的 token'
        }, 404);
    }
    catch (error) {
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
        const { token, cpu_usage, memory_total, memory_used, disk_total, disk_used, network_rx, network_tx, hostname, ip_address, os, version } = await c.req.json();
        if (!token) {
            return c.json({ success: false, message: '缺少API令牌' }, 400);
        }
        // 通过token查找客户端
        const agent = await c.env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first();
        if (!agent) {
            return c.json({ success: false, message: '客户端不存在或令牌无效' }, 404);
        }
        // 更新客户端状态和资源指标
        const result = await c.env.DB.prepare(`UPDATE agents SET 
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
       WHERE id = ?`).bind(cpu_usage, memory_total, memory_used, disk_total, disk_used, network_rx, network_tx, (0, jwt_2.toD1Primitive)(hostname), (0, jwt_2.toD1Primitive)(ip_address), (0, jwt_2.toD1Primitive)(os), (0, jwt_2.toD1Primitive)(version), new Date().toISOString(), agent.id).run();
        if (!result.success) {
            throw new Error('更新客户端状态失败');
        }
        return c.json({
            success: true,
            message: '客户端状态已更新'
        });
    }
    catch (error) {
        console.error('更新客户端状态错误:', error);
        return c.json({ success: false, message: '更新客户端状态失败' }, 500);
    }
});
exports.default = agents;
//# sourceMappingURL=agents.js.map