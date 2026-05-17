import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { Bindings } from './models/db';

// SQLite adapter
import { createDb, closeDb, getRawDb } from './adapters/sqlite';

// Import routes
import authRoutes from './routes/auth';
import monitorRoutes from './routes/monitors';
import agentRoutes from './routes/agents';
import userRoutes from './routes/users';
import statusRoutes from './routes/status';
import initDbRoutes from './setup/database';
import { monitorTask, runScheduledTasks, checkAgentsStatus } from './tasks';
import { toD1Primitive } from './utils/jwt';

const app = new Hono<{ Bindings: Bindings }>();

// Init SQLite (async)
const db = await createDb();

// Create env-like object
const env: any = {
  DB: db,
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  ENABLE_DB_INIT: process.env.ENABLE_DB_INIT || 'true',
};

// Run migrations
import { checkAndInitializeDatabase } from './setup/initCheck';
checkAndInitializeDatabase(env).then(r => console.log('DB init:', r.message));

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'Referer', 'User-Agent'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400,
}));
app.use('*', prettyJSON());

// Inline env setter
app.use('*', async (c, next) => {
  c.env = env;
  await next();
});

// Public routes
app.get('/', (c) => c.json({ message: 'XUGOU API (Node.js)' }));

// Direct agent status handler (takes priority over route module)
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

    const agent = await env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first<{id: number}>();
    if (!agent) return c.json({ success: false, message: 'agent not found' }, 404);

    // Check for first connection
    const now = new Date().toISOString();
    let connectedAt: string | null = null;
    const currentStatus = await env.DB.prepare('SELECT status FROM agents WHERE id = ?').bind(agent.id).first<{status: string}>();
    if (!currentStatus || currentStatus.status === 'inactive') {
      connectedAt = now;
    }

    // Use raw sql.js directly (proven working in test3)
    const rawDb = getRawDb();
    try {
      const stmt = rawDb!.prepare(
        `UPDATE agents SET status='active', cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, network_rx=?, network_tx=?, hostname=?, ip_address=?, os=?, version=?, cpu_arch=?, cpu_model_name=?, cpu_cores=?, load1=?, load5=?, load15=?, boot_time=?, network_rx_total=?, network_tx_total=?, agent_version=?, country=?, connected_at = COALESCE(connected_at, ?), updated_at=?, last_payload=? WHERE id=?`
      );
      stmt.bind([
        cpu, memTotal, memUsed, diskTotal, diskUsed, netRx, netTx,
        toD1Primitive(body.hostname),
        toD1Primitive(body.ip_address ?? (Array.isArray(body.ip_addresses) ? body.ip_addresses[0] : null) ?? (Array.isArray(body.ip) ? body.ip[0] : body.ip) ?? body.IP),
        toD1Primitive(body.os), toD1Primitive(body.version),
        cpuArch, cpuModelName, cpuCores, l1, l5, l15, bt, netRxTotal, netTxTotal, av,
        connectedAt ?? now,
        now, raw.slice(0, 2000), agent.id
      ]);
      stmt.step();
      stmt.free();
      // Verify
      const vs = rawDb!.prepare("SELECT cpu_usage, status FROM agents WHERE id = ?");
      vs.bind([agent.id]);
      vs.step();
      const v = vs.getAsObject() as any;
      vs.free();
      console.log('STATUS_VERIFY:', JSON.stringify(v));
    } catch(e: any) {
      return c.json({ success: false, message: 'update failed: ' + e.message }, 500);
    }

    return c.json({ success: true, message: 'ok' });
  } catch (e: any) {
    console.error('DIRECT_STATUS err:', e.message);
    return c.json({ success: false, message: e.message }, 500);
  }
});

// Route registration
app.route('/api/auth', authRoutes);
app.route('/api/monitors', monitorRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/users', userRoutes);
app.route('/api/status', statusRoutes);
app.route('/api', initDbRoutes);

// Trigger check
app.get('/api/trigger-check', async (c) => {
  const ctx = { env };
  await monitorTask.scheduled(null, env, ctx);
  await checkAgentsStatus(env);
  return c.json({ success: true, message: '监控检查和客户端状态已触发' });
});

// Debug: test adapter UPDATE with various approaches
app.get('/api/debug/test-write', async (c) => {
  try {
    const db_ = getRawDb();
    const agent = env.DB.prepare("SELECT id FROM agents LIMIT 1").first<any>();
    if (!agent) return c.json({ error: 'no agent' });
    const id = agent.id;

    // Test 1: adapter run with 2 params (simple)
    const r1 = env.DB.prepare("UPDATE agents SET cpu_usage = ? WHERE id = ?").bind(88, id).run();
    const s1 = db_.prepare("SELECT cpu_usage FROM agents WHERE id = ?"); s1.bind([id]); s1.step(); const v1 = s1.getAsObject(); s1.free();

    // Test 2: adapter run with 26 params (full status)
    const now = new Date().toISOString();
    const r2 = env.DB.prepare(
      "UPDATE agents SET status='active', cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, hostname=?, ip_address=?, os=?, version=?, updated_at=? WHERE id=?"
    ).bind(99, 100, 50, 200, 100, 't2', '2.2.2.2', 'linux2', 'v2', now, id).run();
    const s2 = db_.prepare("SELECT cpu_usage, hostname, status FROM agents WHERE id = ?"); s2.bind([id]); s2.step(); const v2 = s2.getAsObject(); s2.free();

    // Test 3: full 26-param UPDATE with COALESCE
    const r3 = env.DB.prepare(
      "UPDATE agents SET status='active', cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, network_rx=?, network_tx=?, hostname=?, ip_address=?, os=?, version=?, cpu_arch=?, cpu_model_name=?, cpu_cores=?, load1=?, load5=?, load15=?, boot_time=?, network_rx_total=?, network_tx_total=?, agent_version=?, country=?, connected_at = COALESCE(connected_at, ?), updated_at=?, last_payload=? WHERE id=?"
    ).bind(
      77, 1000, 500, 2000, 1000, 10, 20, 'fulltest', '3.3.3.3', 'linux3', 'v3',
      'x86_64', 'Intel', 4, 1.0, 2.0, 3.0, '2024-01-01', 999, 888, '1.0.0', 'US',
      now, now, '{}', id
    ).run();
    const s3 = db_.prepare("SELECT cpu_usage, hostname, status, cpu_arch, connected_at FROM agents WHERE id = ?"); s3.bind([id]); s3.step(); const v3 = s3.getAsObject(); s3.free();

    return c.json({
      test1: { r1, cpu: v1?.cpu_usage },
      test2: { r2, cpu: v2?.cpu_usage, host: v2?.hostname, status: v2?.status },
      test3: { r3, cpu: v3?.cpu_usage, host: v3?.hostname, status: v3?.status, arch: v3?.cpu_arch, connected: v3?.connected_at }
    });
  } catch(e: any) { return c.json({ error: e.message }, 500); }
});

// Debug old: test DB write with raw sql.js API
app.get('/api/debug/test-write-old', async (c) => {
  try {
    const db_: any = getRawDb();
    if (!db_) return c.json({ error: 'no db' });
    const methods: any = {};

    // Method 1: db.run() - direct raw sql.js
    try { db_.run("UPDATE agents SET cpu_usage = 11 WHERE id = 1"); methods.method1_dbRun = 'ok'; }
    catch(e: any) { methods.method1_dbRun = e.message; }
    let s1 = db_.prepare("SELECT cpu_usage FROM agents WHERE id = 1"); s1.step(); methods.after_dbRun = s1.getAsObject(); s1.free();

    // Method 2: db.exec() - direct raw sql.js
    try { db_.exec("UPDATE agents SET cpu_usage = 22 WHERE id = 1"); methods.method2_dbExec = 'ok'; }
    catch(e: any) { methods.method2_dbExec = e.message; }
    let s2 = db_.prepare("SELECT cpu_usage FROM agents WHERE id = 1"); s2.step(); methods.after_dbExec = s2.getAsObject(); s2.free();

    // Method 3: stmt.bind + step - raw sql.js
    try {
      const st = db_.prepare("UPDATE agents SET cpu_usage = ? WHERE id = ?");
      st.bind([33, 1]);
      st.step();
      st.free();
      methods.method3_bindStep = 'ok';
    } catch(e: any) { methods.method3_bindStep = e.message; }
    let s3 = db_.prepare("SELECT cpu_usage FROM agents WHERE id = 1"); s3.step(); methods.after_bindStep = s3.getAsObject(); s3.free();

    return c.json(methods);
  } catch(e: any) { return c.json({ error: e.message }, 500); }
});

// Start server
const port = parseInt(process.env.PORT || '7860');
console.log(`Xugou Node.js backend starting on http://localhost:${port}`);

// We're already in an async context due to top-level await

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});

// Run scheduled tasks every minute
setInterval(async () => {
  try {
    await runScheduledTasks(null, env, {});
  } catch (e) {
    console.error('Scheduled task error:', e);
  }
}, 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});
