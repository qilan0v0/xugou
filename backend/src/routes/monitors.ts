import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { Bindings } from '../models/db';
import { Monitor, MonitorStatusHistory } from '../models/monitor';
import { getJwtSecret } from '../utils/jwt';

const monitors = new Hono<{ Bindings: Bindings }>();

// 中间件：JWT 认证
monitors.use('*', async (c, next) => {
  const jwtMiddleware = jwt({ alg: "HS256", 
    secret: getJwtSecret(c)
  });
  return jwtMiddleware(c, next);
});

// 获取所有监控
monitors.get('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    
    // 根据用户角色过滤监控
    let result;
    if (payload.role === 'admin') {
      result = await c.env.DB.prepare(
        'SELECT * FROM monitors ORDER BY created_at DESC'
      ).all<Monitor>();
    } else {
      result = await c.env.DB.prepare(
        'SELECT * FROM monitors WHERE created_by = ? ORDER BY created_at DESC'
      ).bind(payload.id).all<Monitor>();
    }
    
    // 获取所有监控的历史状态数据
    if (result.results && result.results.length > 0) {
      const monitorsWithHistory = await Promise.all(result.results.map(async (monitor) => {
        const historyResult = await c.env.DB.prepare(
          `SELECT * FROM monitor_status_history 
           WHERE monitor_id = ? 
           ORDER BY timestamp ASC`
        ).bind(monitor.id).all<MonitorStatusHistory>();
        
        return {
          ...monitor,
          history: historyResult.results || []
        };
      }));
      
      return c.json({ success: true, monitors: monitorsWithHistory });
    }
    
    return c.json({ success: true, monitors: result.results });
  } catch (error) {
    console.error('获取监控列表错误:', error);
    return c.json({ success: false, message: '获取监控列表失败' }, 500);
  }
});

// 获取所有标签（标签池）
monitors.get('/tags/pool', async (c) => {
  try {
    const payload = c.get('jwtPayload');

    let result;
    if (payload.role === 'admin') {
      result = await c.env.DB.prepare(
        "SELECT tags FROM monitors WHERE tags IS NOT NULL AND tags != ''"
      ).all<{ tags: string }>();
    } else {
      result = await c.env.DB.prepare(
        "SELECT tags FROM monitors WHERE created_by = ? AND tags IS NOT NULL AND tags != ''"
      ).bind(payload.id).all<{ tags: string }>();
    }

    const tagSet = new Set<string>();
    for (const row of result.results || []) {
      row.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
    }

    return c.json({ success: true, tags: Array.from(tagSet).sort() });
  } catch (error) {
    console.error('获取监控标签池错误:', error);
    return c.json({ success: false, message: '获取监控标签池失败' }, 500);
  }
});

// 获取单个监控
monitors.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    const monitor = await c.env.DB.prepare(
      'SELECT * FROM monitors WHERE id = ?'
    ).bind(id).first<Monitor>();
    
    if (!monitor) {
      return c.json({ success: false, message: '监控不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && monitor.created_by !== payload.id) {
      return c.json({ success: false, message: '无权访问此监控' }, 403);
    }
    
    // 获取历史状态数据
    const historyResult = await c.env.DB.prepare(
      `SELECT * FROM monitor_status_history 
       WHERE monitor_id = ? 
       ORDER BY timestamp ASC`
    ).bind(id).all<MonitorStatusHistory>();
    
    // 获取最近的检查历史记录
    const checksResult = await c.env.DB.prepare(
      `SELECT * FROM monitor_checks 
       WHERE monitor_id = ? 
       ORDER BY checked_at DESC 
       LIMIT 5`
    ).bind(id).all();
    
    return c.json({ 
      success: true, 
      monitor: {
        ...monitor,
        history: historyResult.results || [],
        checks: checksResult.results || []
      }
    });
  } catch (error) {
    console.error('获取监控详情错误:', error);
    return c.json({ success: false, message: '获取监控详情失败' }, 500);
  }
});

// 创建监控
monitors.post('/', async (c) => {
  try {
    const payload = c.get('jwtPayload');
    const data = await c.req.json();
    
    // 验证必填字段
    if (!data.name || !data.url || !data.method) {
      return c.json({ success: false, message: '缺少必填字段' }, 400);
    }
    
    const now = new Date().toISOString();
    
    // 将 headers 对象转换为 JSON 字符串
    const headers = data.headers ? JSON.stringify(data.headers) : '{}';
    
    // 插入新监控
    const result = await c.env.DB.prepare(
      `INSERT INTO monitors
       (name, url, method, interval, timeout, expected_status, headers, body, created_by, active, status, tags, uptime, response_time, last_checked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.name,
      data.url,
      data.method,
      data.interval || 60,
      data.timeout || 30,
      data.expectedStatus || 200,
      headers,
      data.body || '',
      payload.id,
      true,
      'pending',
      data.tags || null,
      100.0,
      0,
      null,
      now,
      now
    ).run();
    
    if (!result.success) {
      throw new Error('创建监控失败');
    }
    
    // 获取新创建的监控
    const newMonitor = await c.env.DB.prepare(
      'SELECT * FROM monitors WHERE rowid = last_insert_rowid()'
    ).first<Monitor>();
    
    return c.json({ success: true, monitor: newMonitor }, 201);
  } catch (error) {
    console.error('创建监控错误:', error);
    return c.json({ success: false, message: '创建监控失败' }, 500);
  }
});

// 更新监控
monitors.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    const data = await c.req.json();
    
    // 检查监控是否存在
    const monitor = await c.env.DB.prepare(
      'SELECT * FROM monitors WHERE id = ?'
    ).bind(id).first<Monitor>();
    
    if (!monitor) {
      return c.json({ success: false, message: '监控不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && monitor.created_by !== payload.id) {
      return c.json({ success: false, message: '无权修改此监控' }, 403);
    }
    
    // 准备更新数据
    const updates = [];
    const values = [];
    
    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    
    if (data.url !== undefined) {
      updates.push('url = ?');
      values.push(data.url);
    }
    
    if (data.method !== undefined) {
      updates.push('method = ?');
      values.push(data.method);
    }
    
    if (data.interval !== undefined) {
      updates.push('interval = ?');
      values.push(data.interval);
    }
    
    if (data.timeout !== undefined) {
      updates.push('timeout = ?');
      values.push(data.timeout);
    }
    
    if (data.expectedStatus !== undefined) {
      updates.push('expected_status = ?');
      values.push(data.expectedStatus);
    }
    
    if (data.headers !== undefined) {
      updates.push('headers = ?');
      values.push(JSON.stringify(data.headers));
    }
    
    if (data.body !== undefined) {
      updates.push('body = ?');
      values.push(data.body);
    }
    
    if (data.active !== undefined) {
      updates.push('active = ?');
      values.push(data.active);
    }
    
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    
    if (data.uptime !== undefined) {
      updates.push('uptime = ?');
      values.push(data.uptime);
    }
    
    if (data.responseTime !== undefined) {
      updates.push('response_time = ?');
      values.push(data.responseTime);
    }
    
    if (data.lastChecked !== undefined) {
      updates.push('last_checked = ?');
      values.push(data.lastChecked);
    }

    if (data.tags !== undefined) {
      updates.push('tags = ?');
      values.push(data.tags);
    }

    if (data.public !== undefined) {
      updates.push('public = ?');
      values.push(data.public ? 1 : 0);
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    
    // 添加 ID 作为 WHERE 条件
    values.push(id);
    
    // 执行更新
    const result = await c.env.DB.prepare(
      `UPDATE monitors SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();
    
    if (!result.success) {
      throw new Error('更新监控失败');
    }
    
    // 获取更新后的监控
    const updatedMonitor = await c.env.DB.prepare(
      'SELECT * FROM monitors WHERE id = ?'
    ).bind(id).first<Monitor>();
    
    return c.json({ success: true, monitor: updatedMonitor });
  } catch (error) {
    console.error('更新监控错误:', error);
    return c.json({ success: false, message: '更新监控失败' }, 500);
  }
});

// 删除监控
monitors.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 检查监控是否存在
    const monitor = await c.env.DB.prepare(
      'SELECT * FROM monitors WHERE id = ?'
    ).bind(id).first<Monitor>();
    
    if (!monitor) {
      return c.json({ success: false, message: '监控不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && monitor.created_by !== payload.id) {
      return c.json({ success: false, message: '无权删除此监控' }, 403);
    }

    // 先删除关联的历史数据
    await c.env.DB.prepare(
      'DELETE FROM monitor_status_history WHERE monitor_id = ?'
    ).bind(id).run();
    
    await c.env.DB.prepare(
      'DELETE FROM monitor_checks WHERE monitor_id = ?'
    ).bind(id).run();
    
    // 执行删除
    const result = await c.env.DB.prepare(
      'DELETE FROM monitors WHERE id = ?'
    ).bind(id).run();
    
    if (!result.success) {
      throw new Error('删除监控失败');
    }
    
    return c.json({ success: true, message: '监控已删除' });
  } catch (error) {
    console.error('删除监控错误:', error);
    return c.json({ success: false, message: '删除监控失败' }, 500);
  }
});

// 获取监控状态历史
monitors.get('/:id/history', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 检查监控是否存在
    const monitor = await c.env.DB.prepare(
      'SELECT * FROM monitors WHERE id = ?'
    ).bind(id).first<Monitor>();
    
    if (!monitor) {
      return c.json({ success: false, message: '监控不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && monitor.created_by !== payload.id) {
      return c.json({ success: false, message: '无权访问此监控历史' }, 403);
    }
    
    // 获取历史状态
    const historyResult = await c.env.DB.prepare(
      `SELECT * FROM monitor_status_history 
       WHERE monitor_id = ? 
       ORDER BY timestamp ASC`
    ).bind(id).all<MonitorStatusHistory>();
    
    return c.json({ 
      success: true, 
      history: historyResult.results || [] 
    });
  } catch (error) {
    console.error('获取监控历史错误:', error);
    return c.json({ success: false, message: '获取监控历史失败' }, 500);
  }
});

// 获取监控检查记录
monitors.get('/:id/checks', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    const limit = parseInt(c.req.query('limit') || '10');
    
    // 检查监控是否存在
    const monitor = await c.env.DB.prepare(
      'SELECT * FROM monitors WHERE id = ?'
    ).bind(id).first<Monitor>();
    
    if (!monitor) {
      return c.json({ success: false, message: '监控不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && monitor.created_by !== payload.id) {
      return c.json({ success: false, message: '无权访问此监控检查记录' }, 403);
    }
    
    // 获取检查记录
    const checksResult = await c.env.DB.prepare(
      `SELECT * FROM monitor_checks 
       WHERE monitor_id = ? 
       ORDER BY checked_at DESC 
       LIMIT ?`
    ).bind(id, limit).all();
    
    return c.json({ 
      success: true, 
      checks: checksResult.results || [] 
    });
  } catch (error) {
    console.error('获取监控检查记录错误:', error);
    return c.json({ success: false, message: '获取监控检查记录失败' }, 500);
  }
});

// 手动检查单个监控
monitors.post('/:id/check', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const payload = c.get('jwtPayload');
    
    // 检查监控是否存在
    const monitor = await c.env.DB.prepare(
      'SELECT * FROM monitors WHERE id = ?'
    ).bind(id).first<Monitor>();
    
    if (!monitor) {
      return c.json({ success: false, message: '监控不存在' }, 404);
    }
    
    // 检查权限
    if (payload.role !== 'admin' && monitor.created_by !== payload.id) {
      return c.json({ success: false, message: '无权访问此监控' }, 403);
    }
    
    // 触发监控检查
    const startTime = Date.now();
    let response;
    let error = null;
    
    // 解析 headers
    let headers = {};
    try {
      headers = JSON.parse(monitor.headers || '{}');
    } catch (e) {
      console.error('解析请求头错误:', e);
    }
    
    // 执行请求
    try {
      const controller = new AbortController();
      // 设置超时
      const timeoutId = setTimeout(() => controller.abort(), monitor.timeout * 1000);
      
      response = await fetch(monitor.url, {
        method: monitor.method,
        headers: headers,
        body: monitor.method !== 'GET' && monitor.method !== 'HEAD' ? monitor.body : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    
    const responseTime = Date.now() - startTime;
    const now = new Date().toISOString();
    let status = 'down';
    
    // 判断状态
    let isUp = false;
    
    // 支持状态码范围检查
    if (monitor.expected_status === 2) {
      // 如果是2，则表示2xx
      isUp = response ? (response.status >= 200 && response.status < 300) : false;
    } else if (monitor.expected_status === 3) {
      // 如果是3，则表示3xx
      isUp = response ? (response.status >= 300 && response.status < 400) : false;
    } else if (monitor.expected_status === 4) {
      // 如果是4，则表示4xx
      isUp = response ? (response.status >= 400 && response.status < 500) : false;
    } else if (monitor.expected_status === 5) {
      // 如果是5，则表示5xx
      isUp = response ? (response.status >= 500 && response.status < 600) : false;
    } else {
      // 其他情况，精确匹配
      isUp = response ? (response.status === monitor.expected_status) : false;
    }
    
    status = isUp ? 'up' : 'down';
    
    // 添加调试日志
    console.log(`监控状态判断: 返回状态码=${response?.status}, 期望状态码=${monitor.expected_status}, 最终状态=${status}`);
    
    // 更新监控状态
    await c.env.DB.prepare(`
      UPDATE monitors
      SET status = ?, response_time = ?, last_checked = ?
      WHERE id = ?
    `).bind(
      status,
      responseTime,
      now,
      monitor.id
    ).run();
    
    // 添加检查记录
    await c.env.DB.prepare(`
      INSERT INTO monitor_checks
      (monitor_id, status, response_time, status_code, error, checked_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      monitor.id,
      status,
      responseTime,
      response ? response.status : null,
      error,
      now
    ).run();
    
    // 添加状态历史记录（仅当状态变化时）
    if (monitor.status !== status) {
      await c.env.DB.prepare(`
        INSERT INTO monitor_status_history
        (monitor_id, status, timestamp)
        VALUES (?, ?, ?)
      `).bind(
        monitor.id,
        status,
        now
      ).run();
    }
    
    return c.json({ 
      success: true,
      message: '监控检查完成',
      result: {
        monitor_id: monitor.id,
        name: monitor.name,
        status,
        previous_status: monitor.status,
        response_time: responseTime,
        status_code: response ? response.status : null,
        error,
        checked_at: now
      }
    });
  } catch (error) {
    console.error('手动检查监控错误:', error);
    return c.json({ success: false, message: '手动检查监控失败' }, 500);
  }
});

export default monitors; 