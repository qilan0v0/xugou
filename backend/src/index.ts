import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { Bindings } from './models/db';
import { prettyJSON } from 'hono/pretty-json';
import { checkAndInitializeDatabase } from './setup/initCheck';
import { toD1Primitive, generateAgentName, addDuration } from './utils/jwt';
import { sendAgentNotification } from './tasks/agent-task';

// 声明环境变量类型
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: string;
      PORT?: string;
      JWT_SECRET?: string;
    }
  }
}

// 定义 D1 数据库类型
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec<T = unknown>(query: string): Promise<D1Result<T>>;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: object;
}

// 导入路由
import { rateLimit } from './utils/ratelimit';
import authRoutes from './routes/auth';
import monitorRoutes from './routes/monitors';
import agentRoutes from './routes/agents';
import userRoutes from './routes/users';
import statusRoutes from './routes/status';
import initDbRoutes from './setup/database';
import { monitorTask, runScheduledTasks, checkAgentsStatus } from './tasks';

// 创建Hono应用
const app = new Hono<{ Bindings: Bindings }>();

// 中间件，需要作为服务端接收所有来源客户端的请求
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    const allowed = ['xugou-frontend.pages.dev', 'xugou.mdzz.uk', 'localhost', '127.0.0.1'];
    if (!origin || allowed.some(d => origin.includes(d))) return origin;
    return 'https://xugou-frontend.pages.dev';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
app.use('*', prettyJSON());

// 在 Workers 环境中，您可能需要设置这些响应头
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', c.req.header('origin') || '*');
  c.header('Access-Control-Allow-Credentials', 'true');
});

// 公共路由
app.get('/', (c) => c.json({ message: 'XUGOU API 服务正在运行' }));

// 获取 JWT 密钥
const getJwtSecret = (c: any) => {
  // 在 Cloudflare Workers 环境中，使用 env 变量
  if (typeof process === 'undefined') {
    return c.env.JWT_SECRET || 'your-secret-key-change-in-production';
  }
  // 在 Node.js 环境中，使用 process.env
  return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
};

// 直接处理 agent status 上报 (在子路由之前匹配，确保优先处理)
app.post('/api/agents/status', async (c) => {
  try {
    const raw = await c.req.text();
    const body = JSON.parse(raw);
    const token = body.token;
    const cpu = body.cpu_usage ?? body.cpu?.usage ?? null;
    const memTotal = body.memory_total ?? body.memory?.total ?? null;
    const memUsed = body.memory_used ?? body.memory?.used ?? null;
    let diskTotal = body.disk_total;
    let diskUsed = body.disk_used;
    if ((diskTotal == null) && Array.isArray(body.disks)) {
      diskTotal = body.disks.reduce((s: number, d: any) => s + (d.total || 0), 0);
      diskUsed = body.disks.reduce((s: number, d: any) => s + (d.used || 0), 0);
    }
    let netRx = body.network_rx;
    let netTx = body.network_tx;
    if ((netRx == null) && Array.isArray(body.network)) {
      netRx = body.network.reduce((s: number, n: any) => s + (n.bytes_recv || 0), 0);
      netTx = body.network.reduce((s: number, n: any) => s + (n.bytes_sent || 0), 0);
    }

    // New system info fields from nested SystemInfo JSON
    const cpuArch = toD1Primitive(body.cpu_arch ?? body.cpu?.arch ?? null);
    const cpuModelName = toD1Primitive(body.cpu_model_name ?? body.cpu?.model_name ?? null);
    const cpuCores = body.cpu_cores ?? body.cpu?.cores ?? null;
    const l1 = body.load1 ?? body.load?.load1 ?? null;
    const l5 = body.load5 ?? body.load?.load5 ?? null;
    const l15 = body.load15 ?? body.load?.load15 ?? null;
    const bt = toD1Primitive(body.boot_time ?? null);
    const av = toD1Primitive(body.agent_version ?? null);
    let netRxTotal = body.network_rx_total;
    let netTxTotal = body.network_tx_total;
    if ((netRxTotal == null) && Array.isArray(body.network)) {
      netRxTotal = body.network.reduce((s: number, n: any) => s + (n.bytes_recv || 0), 0);
      netTxTotal = body.network.reduce((s: number, n: any) => s + (n.bytes_sent || 0), 0);
    }

    if (!token) return c.json({ success: false, message: 'no token' }, 400);

    // 从 Cloudflare 请求元数据提取国家代码 (before auto-create)
    const country = (c.req.raw as any)?.cf?.country ?? null;

    let isNewAgent = false;
    let agent = await c.env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first<{id: number}>();
    if (!agent) {
      const adminUser = await c.env.DB.prepare('SELECT id FROM users WHERE role = ?').bind('admin').first<{id: number}>();
      if (!adminUser) return c.json({ success: false, message: 'no admin user' }, 500);
      const autoName = generateAgentName(country);
      const now = new Date().toISOString();
      await c.env.DB.prepare(
        `INSERT INTO agents (name, token, created_by, status, created_at, updated_at, connected_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`
      ).bind(autoName, token, adminUser.id, now, now, now).run();
      agent = await c.env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first<{id: number}>();
      if (!agent) return c.json({ success: false, message: 'auto-create failed' }, 500);
      isNewAgent = true;
    }

    // 首次连接/重连时刷新 connected_at
    const now = new Date().toISOString();
    const prev = await c.env.DB.prepare('SELECT status, updated_at, connected_at FROM agents WHERE id = ?').bind(agent.id).first<{status: string; updated_at: string; connected_at: string | null}>();
    const currentStatus = prev?.status;
    const gapMs = prev?.updated_at ? Date.now() - new Date(prev.updated_at).getTime() : 0;
    const wasDisconnected = gapMs > 120000;
    const wasInactive = isNewAgent || !currentStatus || currentStatus === 'inactive' || wasDisconnected || !prev?.connected_at;
    if (wasInactive) {
      await c.env.DB.prepare('UPDATE agents SET connected_at = ? WHERE id = ?').bind(now, agent.id).run();
    }

    const result = await c.env.DB.prepare(
      `UPDATE agents SET status='active', cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, network_rx=?, network_tx=?, hostname=?, ip_address=?, os=?, version=?, cpu_arch=?, cpu_model_name=?, cpu_cores=?, load1=?, load5=?, load15=?, boot_time=?, network_rx_total=?, network_tx_total=?, agent_version=?, country=?, updated_at=?, last_payload=? WHERE id=?`
    ).bind(
      cpu, memTotal, memUsed, diskTotal, diskUsed, netRx, netTx,
      toD1Primitive(body.hostname), toD1Primitive(body.ip_address ?? (Array.isArray(body.ip_addresses) ? body.ip_addresses[0] : null) ?? (Array.isArray(body.ip) ? body.ip[0] : body.ip) ?? body.IP),
      toD1Primitive(body.os), toD1Primitive(body.version),
      cpuArch, cpuModelName, cpuCores, l1, l5, l15, bt, netRxTotal, netTxTotal, av,
      country,
      now, raw.slice(0, 2000), agent.id
    ).run();

    
    if (!result.success) {
      console.error('DIRECT_STATUS update failed:', result.error);
      return c.json({ success: false, message: 'update failed: ' + (result.error || 'unknown') }, 500);
    }

    // 首次上线通知
    if (wasInactive) {
      const fullAgent = await c.env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agent.id).first<any>();
      if (fullAgent) {
        console.log(`[上线] ${fullAgent.hostname || fullAgent.name || agent.id} 已上线`);
        sendAgentNotification(c.env, fullAgent, 'up').catch(e => console.error('[通知] 上线通知失败:', e.message));
      }
    }

    // 自动续期
    const agentForRenew = await c.env.DB.prepare(
      'SELECT expiry_time, duration_value, duration_unit FROM agents WHERE id = ?'
    ).bind(agent.id).first<{expiry_time: string | null; duration_value: number | null; duration_unit: string | null}>();
    if (agentForRenew?.expiry_time && agentForRenew?.duration_value && agentForRenew?.duration_unit) {
      if (new Date() > new Date(agentForRenew.expiry_time)) {
        const newExpiry = addDuration(new Date(), agentForRenew.duration_value, agentForRenew.duration_unit);
        await c.env.DB.prepare(
          'UPDATE agents SET start_time = ?, expiry_time = ? WHERE id = ?'
        ).bind(new Date().toISOString(), newExpiry.toISOString(), agent.id).run();
      }
    }

    return c.json({ success: true, message: 'ok' });
  } catch (e: any) {
    console.error('DIRECT_STATUS err:', e.message);
    return c.json({ success: false, message: e.message }, 500);
  }
});

// 限流: 登录/注册 每分钟最多10次
app.use('/api/auth/*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  if (!rateLimit('auth:' + ip, 10, 60000)) {
    return c.json({ success: false, message: '请求过于频繁，请稍后再试' }, 429);
  }
  await next();
});

// 路由注册
app.route('/api/auth', authRoutes);
app.route('/api/monitors', monitorRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/users', userRoutes);
app.route('/api/status', statusRoutes);
app.route('/api', initDbRoutes);

// 添加监控检查触发路由
app.get('/api/trigger-check', async (c) => {
  const { scheduled } = monitorTask;
  if (scheduled) {
    await scheduled(null, c.env, null);
  }
  await checkAgentsStatus(c.env);
  return c.json({ success: true, message: '监控检查和客户端状态已触发' });
});

// 数据库状态标志，用于记录数据库初始化状态
let dbInitialized = false;

// 导出 fetch 函数供 Cloudflare Workers 使用
export default {
  // 处理 HTTP 请求
  async fetch(request: Request, env: any, ctx: any) {
    try {
      // 如果数据库尚未初始化，则进行初始化检查
      if (!dbInitialized) {
        console.log('首次请求，检查数据库状态...');
        try {
          const initResult = await checkAndInitializeDatabase(env);
          dbInitialized = true;
          console.log('数据库检查结果:', initResult.message);
        } catch (error) {
          console.error('数据库初始化检查失败:', error);
          // 即使初始化失败，也设置标志位以避免重复检查
          dbInitialized = true;
        }
      }
      
      // 处理请求
      return app.fetch(request, env, ctx);
    } catch (error) {
      console.error('请求处理错误:', error);
      return new Response(JSON.stringify({ error: '服务器内部错误' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
  
  // 添加定时任务，每分钟执行一次监控检查和客户端状态检查
  async scheduled(event: any, env: any, ctx: any) {
    try {
      // 首先检查数据库状态
      if (!dbInitialized) {
        const initResult = await checkAndInitializeDatabase(env);
        dbInitialized = true;
        console.log('数据库检查结果:', initResult.message);
      }
      
      // 执行所有定时任务
      await runScheduledTasks(event, env, ctx);
    } catch (error) {
      console.error('定时任务执行出错:', error);
    }
  }
}; 