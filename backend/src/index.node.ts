import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { Bindings } from './models/db';

import { createDb, closeDb } from './adapters/sqlite';

import authRoutes from './routes/auth';
import monitorRoutes from './routes/monitors';
import agentRoutes from './routes/agents';
import userRoutes from './routes/users';
import statusRoutes from './routes/status';
import initDbRoutes from './setup/database';
import { monitorTask, runScheduledTasks, checkAgentsStatus } from './tasks';
import { toD1Primitive, generateAgentName } from './utils/jwt';
import { WebSocketServer, WebSocket } from 'ws';
import { rateLimit } from './utils/ratelimit';

// GeoIP cache (module-level)
const countryCache = new Map<string, string>();

const app = new Hono<{ Bindings: Bindings }>();

import { readFileSync, existsSync } from 'fs';
const configPath = process.env.CONFIG_PATH || './config.json';
let config: any = { port: 7860, hostname: '0.0.0.0', jwt_secret: 'change-me', enable_db_init: true, db_path: './data/xugou.db' };
if (existsSync(configPath)) {
  try { config = { ...config, ...JSON.parse(readFileSync(configPath, 'utf-8')) }; } catch(e) {}
}

const db = await createDb(config.db_path);

const env: any = {
  DB: db,
  JWT_SECRET: config.jwt_secret || 'change-me',
  ENABLE_DB_INIT: config.enable_db_init ? 'true' : 'false',
};

import { checkAndInitializeDatabase } from './setup/initCheck';
checkAndInitializeDatabase(env).then(r => console.log('DB init:', r.message));

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    const allowed = ['xugou-frontend.pages.dev', 'xugou.mdzz.uk', 'localhost', '127.0.0.1', 'qilan.sbs', 'serv00.net'];
    if (!origin || allowed.some(d => origin.includes(d))) return origin;
    return 'https://xugou-frontend.pages.dev';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
  maxAge: 86400,
}));
app.use('*', prettyJSON());

app.use('*', async (c, next) => {
  c.env = env;
  await next();
});

app.get('/', (c) => c.json({ message: 'XUGOU API (Node.js)' }));

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
    // Calculate network totals from cumulative bytes
    let netRxTotal = body.network_rx_total;
    let netTxTotal = body.network_tx_total;
    if ((netRxTotal == null) && Array.isArray(body.network)) {
      netRxTotal = body.network.reduce((s: number, n: any) => s + (n.bytes_recv || 0), 0);
      netTxTotal = body.network.reduce((s: number, n: any) => s + (n.bytes_sent || 0), 0);
    }

    let netRx = body.network_rx;
    let netTx = body.network_tx;

    const cpuArch = toD1Primitive(body.cpu_arch ?? body.cpu?.arch ?? null);
    const cpuModelName = toD1Primitive(body.cpu_model_name ?? body.cpu?.model_name ?? null);
    const cpuCores = body.cpu_cores ?? body.cpu?.cores ?? null;
    const l1 = body.load1 ?? body.load?.load1 ?? null;
    const l5 = body.load5 ?? body.load?.load5 ?? null;
    const l15 = body.load15 ?? body.load?.load15 ?? null;
    const bt = toD1Primitive(body.boot_time ?? null);
    const av = toD1Primitive(body.agent_version ?? null);

    if (!token) return c.json({ success: false, message: 'no token' }, 400);

    // Look up country from client IP (before agent auto-create)
    const forwarded = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '';
    const clientIp = forwarded.split(',')[0]?.trim();
    let country: string | null = null;
    if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
      if (countryCache.has(clientIp)) {
        country = countryCache.get(clientIp)!;
      } else {
        try {
          const res = await fetch('http://ip-api.com/json/' + clientIp + '?fields=countryCode');
          if (res.ok) {
            const data = await res.json() as any;
            country = data?.countryCode || null;
            if (country) countryCache.set(clientIp, country);
          }
        } catch (e) { /* ignore */ }
      }
    }

    let agent = await env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first<{id: number}>();
    if (!agent) {
      const adminUser = env.DB.prepare('SELECT id FROM users WHERE role = ?').bind('admin').first<{id: number}>();
      if (!adminUser) return c.json({ success: false, message: 'no admin user' }, 500);
      const autoName = generateAgentName(country);
      const now2 = new Date().toISOString();
      env.DB.prepare(
        `INSERT INTO agents (name, token, created_by, status, created_at, updated_at, connected_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?)`
      ).bind(autoName, token, adminUser.id, now2, now2, now2).run();
      agent = env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first<{id: number}>();
      if (!agent) return c.json({ success: false, message: 'auto-create failed' }, 500);
    }

    // Recalc network rate from cumulative byte delta if agent reports 0
    if ((netRx == null || netRx === 0) && netRxTotal != null) {
      const prev = env.DB.prepare('SELECT network_rx_total, network_tx_total, updated_at FROM agents WHERE id = ?').bind(agent.id).first<any>();
      if (prev && prev.network_rx_total != null) {
        const elapsed = (Date.now() - new Date(prev.updated_at).getTime()) / 1000;
        if (elapsed > 0 && elapsed < 3600) {
          netRx = Math.max(0, (netRxTotal - (prev.network_rx_total || 0)) / elapsed / 1024);
          netTx = Math.max(0, (netTxTotal - (prev.network_tx_total || 0)) / elapsed / 1024);
        }
      }
    }

    const now = new Date().toISOString();
    const currentStatus = await env.DB.prepare('SELECT status FROM agents WHERE id = ?').bind(agent.id).first<{status: string}>();
    const wasInactive = !currentStatus || currentStatus.status === 'inactive';
    if (wasInactive) {
      env.DB.prepare('UPDATE agents SET connected_at = ? WHERE id = ?').bind(now, agent.id).run();
    }

    const result = env.DB.prepare(
      `UPDATE agents SET status='active', cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, network_rx=?, network_tx=?, hostname=?, ip_address=?, os=?, version=?, cpu_arch=?, cpu_model_name=?, cpu_cores=?, load1=?, load5=?, load15=?, boot_time=?, network_rx_total=?, network_tx_total=?, agent_version=?, country=?, updated_at=?, last_payload=? WHERE id=?`
    ).bind(
      cpu, memTotal, memUsed, diskTotal, diskUsed, netRx, netTx,
      toD1Primitive(body.hostname),
      toD1Primitive(body.ip_address ?? (Array.isArray(body.ip_addresses) ? body.ip_addresses[0] : null) ?? (Array.isArray(body.ip) ? body.ip[0] : body.ip) ?? body.IP),
      toD1Primitive(body.os), toD1Primitive(body.version),
      cpuArch, cpuModelName, cpuCores, l1, l5, l15, bt, netRxTotal, netTxTotal, av,
      country,
      now, raw.slice(0, 2000), agent.id
    ).run();

    if (!result.success) {
      console.error('Status update failed:', result.error);
      return c.json({ success: false, message: 'update failed' }, 500);
    }

    // Broadcast real-time update to connected WebSocket clients
    broadcast?.('agent-update', { id: agent.id });

    return c.json({ success: true, message: 'ok' });
  } catch (e: any) {
    console.error('Status err:', e.message);
    return c.json({ success: false, message: e.message }, 500);
  }
});

app.route('/api/auth', authRoutes);
app.route('/api/monitors', monitorRoutes);
app.route('/api/agents', agentRoutes);
app.route('/api/users', userRoutes);
app.route('/api/status', statusRoutes);
app.route('/api', initDbRoutes);

app.get('/api/trigger-check', async (c) => {
  await monitorTask.scheduled(null, env, {});
  await checkAgentsStatus(env);
  return c.json({ success: true, message: 'checks triggered' });
});

import { createServer } from 'http';
const port = parseInt(process.env.PORT || config.port || '7860');
const host = process.env.HOSTNAME || config.hostname || '0.0.0.0';

// WebSocket broadcast
let broadcast = (type: string, data: any) => {};

const httpServer = createServer(async (req, res) => {
  const webRes = await app.fetch(req);
  res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
  if (webRes.body) {
    const reader = webRes.body.getReader();
    const pump = () => reader.read().then(({ done, value }) => {
      if (done) { res.end(); return; }
      res.write(value); pump();
    });
    pump();
  } else { res.end(); }
});

const wss = new WebSocketServer({ server: httpServer });
const clients = new Set<WebSocket>();
wss.on('connection', (ws) => { clients.add(ws); ws.on('close', () => clients.delete(ws)); });
broadcast = (type, data) => {
  const msg = JSON.stringify({ type, data, time: new Date().toISOString() });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
};

httpServer.listen(port, host, () => {
  console.log(`Xugou Node.js backend on http://${host}:${port}`);
  console.log('WebSocket ready');
});

setInterval(async () => {
  try { await runScheduledTasks(null, env, {}); }
  catch (e) { console.error('Scheduled task error:', e); }
}, 60 * 1000);

process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });
