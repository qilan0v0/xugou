"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const jwt_1 = require("hono/jwt");
const jwt_2 = require("../utils/jwt");
// 创建 Hono 路由
const app = new hono_1.Hono();
// 保护管理员路由
const adminRoutes = new hono_1.Hono()
    .use('*', async (c, next) => {
    try {
        const jwtMiddleware = (0, jwt_1.jwt)({ alg: "HS256",
            secret: (0, jwt_2.getJwtSecret)(c)
        });
        await jwtMiddleware(c, next);
        const payload = c.get('jwtPayload');
        if (!payload || !payload.id) {
            return c.json({ error: '未授权' }, 401);
        }
        // 这里不再调用next()，防止重复调用
    }
    catch (error) {
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
        const configResult = await c.env.DB.prepare('SELECT * FROM status_page_config WHERE user_id = ?').bind(userId).all();
        let config = null;
        if (configResult.results && configResult.results.length > 0) {
            config = configResult.results[0];
        }
        // 获取配置的监控项
        const monitorsResult = await c.env.DB.prepare('SELECT m.id, m.name, CASE WHEN spm.monitor_id IS NOT NULL THEN 1 ELSE 0 END as selected ' +
            'FROM monitors m ' +
            'LEFT JOIN status_page_monitors spm ON m.id = spm.monitor_id AND spm.config_id = ? ' +
            'WHERE m.created_by = ?').bind(config?.id || 0, userId).all();
        // 获取配置的客户端
        const agentsResult = await c.env.DB.prepare('SELECT a.id, a.name, CASE WHEN spa.agent_id IS NOT NULL THEN 1 ELSE 0 END as selected ' +
            'FROM agents a ' +
            'LEFT JOIN status_page_agents spa ON a.id = spa.agent_id AND spa.config_id = ? ' +
            'WHERE a.created_by = ?').bind(config?.id || 0, userId).all();
        // 构建响应
        const response = {
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
    }
    catch (error) {
        console.error('获取状态页配置失败:', error);
        return c.json({ error: '获取状态页配置失败' }, 500);
    }
});
// 保存状态页配置
adminRoutes.post('/config', async (c) => {
    const payload = c.get('jwtPayload');
    const userId = payload.id;
    const data = await c.req.json();
    console.log('接收到的配置数据:', JSON.stringify(data));
    if (!data) {
        console.log('无效的请求数据');
        return c.json({ error: '无效的请求数据' }, 400);
    }
    try {
        // 检查是否已存在配置
        const existingConfig = await c.env.DB.prepare('SELECT id FROM status_page_config WHERE user_id = ?').bind(userId).first();
        console.log('现有配置查询结果:', existingConfig);
        let configId;
        if (existingConfig && existingConfig.id) {
            // 更新现有配置
            console.log('更新现有配置ID:', existingConfig.id);
            await c.env.DB.prepare('UPDATE status_page_config SET title = ?, description = ?, logo_url = ?, custom_css = ? WHERE id = ?').bind(data.title, data.description, data.logoUrl, data.customCss, existingConfig.id).run();
            configId = existingConfig.id;
        }
        else {
            // 创建新配置
            console.log('创建新配置');
            const insertResult = await c.env.DB.prepare('INSERT INTO status_page_config (user_id, title, description, logo_url, custom_css) VALUES (?, ?, ?, ?, ?)').bind(userId, data.title, data.description, data.logoUrl, data.customCss).run();
            console.log('插入配置结果:', insertResult);
            if (!insertResult.success) {
                throw new Error('创建状态页配置失败');
            }
            // 获取新插入的ID
            const lastInsertId = await c.env.DB.prepare('SELECT last_insert_rowid() as id').first();
            console.log('获取的最后插入ID:', lastInsertId);
            if (!lastInsertId || typeof lastInsertId.id !== 'number') {
                throw new Error('获取配置ID失败');
            }
            configId = lastInsertId.id;
        }
        // 清除现有的监控项关联
        console.log('清除配置ID的现有监控关联:', configId);
        const deleteMonitorsResult = await c.env.DB.prepare('DELETE FROM status_page_monitors WHERE config_id = ?').bind(configId).run();
        console.log('删除现有监控关联结果:', deleteMonitorsResult);
        // 清除现有的客户端关联
        console.log('清除配置ID的现有客户端关联:', configId);
        const deleteAgentsResult = await c.env.DB.prepare('DELETE FROM status_page_agents WHERE config_id = ?').bind(configId).run();
        console.log('删除现有客户端关联结果:', deleteAgentsResult);
        // 添加选定的监控项
        console.log('接收到的监控项IDs:', data.monitors);
        if (Array.isArray(data.monitors) && data.monitors.length > 0) {
            console.log(`添加 ${data.monitors.length} 个监控项`);
            for (const monitorId of data.monitors) {
                const insertResult = await c.env.DB.prepare('INSERT INTO status_page_monitors (config_id, monitor_id) VALUES (?, ?)').bind(configId, monitorId).run();
                console.log(`添加监控项 ${monitorId} 结果:`, insertResult);
            }
        }
        else {
            console.log('没有选中的监控项需要添加');
        }
        // 添加选定的客户端
        console.log('接收到的客户端IDs:', data.agents);
        if (Array.isArray(data.agents) && data.agents.length > 0) {
            console.log(`添加 ${data.agents.length} 个客户端`);
            for (const agentId of data.agents) {
                const insertResult = await c.env.DB.prepare('INSERT INTO status_page_agents (config_id, agent_id) VALUES (?, ?)').bind(configId, agentId).run();
                console.log(`添加客户端 ${agentId} 结果:`, insertResult);
            }
        }
        else {
            console.log('没有选中的客户端需要添加');
        }
        return c.json({ success: true, configId });
    }
    catch (error) {
        console.error('保存状态页配置失败:', error);
        return c.json({ error: '保存状态页配置失败' }, 500);
    }
});
// 公共路由 - 获取公开状态页数据
app.get('/data', async (c) => {
    try {
        // Get all public agents and monitors directly
        const monitors = await c.env.DB.prepare("SELECT * FROM monitors WHERE active = 1 AND public = 1 ORDER BY created_at DESC").all();
        const agents = await c.env.DB.prepare("SELECT * FROM agents WHERE public = 1 ORDER BY created_at DESC").all();
        // Enrich agents with computed fields
        const enrichedAgents = (agents.results || []).map((agent) => {
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
    }
    catch (error) {
        console.error('获取状态页数据失败:', error);
        return c.json({ success: false, message: '获取状态页数据失败' }, 500);
    }
});
app.route('/', adminRoutes);
exports.default = app;
//# sourceMappingURL=status.js.map