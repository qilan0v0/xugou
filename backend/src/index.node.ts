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

    // 首次上线通知 (wasInactive → active)
    if (wasInactive) {
      const fullAgent = await env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agent.id).first<any>();
      if (fullAgent) {
        const now2 = new Date().toISOString();
        const memPct = fullAgent.memory_total && fullAgent.memory_used ? Math.round((fullAgent.memory_used/fullAgent.memory_total)*100) : 0;
        const diskPct = fullAgent.disk_total && fullAgent.disk_used ? Math.round((fullAgent.disk_used/fullAgent.disk_total)*100) : 0;
        const upMs = fullAgent.boot_time ? Math.max(0, Date.now() - new Date(fullAgent.boot_time).getTime()) : 0;
        const upDays = upMs ? Math.floor(upMs / 86400000) : 0;
        const upHours = upMs ? Math.floor((upMs % 86400000) / 3600000) : 0;
        const memTotalGB = fullAgent.memory_total ? (fullAgent.memory_total / 1073741824).toFixed(1) : '';
        const diskTotalGB = fullAgent.disk_total ? (fullAgent.disk_total / 1073741824).toFixed(1) : '';
        const netRxTotal = fullAgent.network_rx_total ? (fullAgent.network_rx_total / 1073741824).toFixed(2) : '';
        const netTxTotal = fullAgent.network_tx_total ? (fullAgent.network_tx_total / 1073741824).toFixed(2) : '';
        const totalTraffic = ((fullAgent.network_rx_total || 0) + (fullAgent.network_tx_total || 0)) / 1073741824;
        const fmtDateTime = (s: string) => { try { return new Date(s).toLocaleString('zh-CN'); } catch { return s || ''; } };

        const vars: Record<string,string> = {
          name: fullAgent.name || '', status: '在线', time: now2,
          hostname: fullAgent.hostname || '', ip: fullAgent.ip_address || '', os: fullAgent.os || '',
          version: fullAgent.version || '',
          cpu: fullAgent.cpu_usage ? `${Math.round(fullAgent.cpu_usage)}%` : '',
          cpu_cores: fullAgent.cpu_cores ? String(fullAgent.cpu_cores) : '',
          cpu_model: fullAgent.cpu_model_name || '',
          cpu_arch: fullAgent.cpu_arch || '',
          memory: memPct ? `${memPct}%` : '', memory_total: memTotalGB ? `${memTotalGB} GiB` : '',
          disk: diskPct ? `${diskPct}%` : '', disk_total: diskTotalGB ? `${diskTotalGB} GiB` : '',
          uptime: upMs ? `${upDays}d ${upHours}h` : '',
          load: fullAgent.load1 != null ? `${fullAgent.load1.toFixed(2)} / ${(fullAgent.load5||0).toFixed(2)} / ${(fullAgent.load15||0).toFixed(2)}` : '',
          country: fullAgent.country || '',
          agent_version: fullAgent.agent_version || '',
          boot_time: fullAgent.boot_time ? fmtDateTime(fullAgent.boot_time) : '',
          connected_at: fullAgent.connected_at ? fmtDateTime(fullAgent.connected_at) : '',
          network_rx_total: netRxTotal ? `${netRxTotal} GiB` : '',
          network_tx_total: netTxTotal ? `${netTxTotal} GiB` : '',
          traffic_total: totalTraffic ? `${totalTraffic.toFixed(2)} GiB` : '',
          message: `${fullAgent.name} 已上线`, url: '', response_time: '',
        };
        try {
          const cfg = await env.DB.prepare('SELECT * FROM webhook_config WHERE user_id = ?').bind(fullAgent.created_by).first<any>();
          if (cfg && cfg.webhook_url && cfg.notify_up) {
            let body = cfg.webhook_body_up || '';
            for (const [k,v] of Object.entries(vars)) body = body.replace(new RegExp(`\\{${k}\\}`,'g'), v);
            const headers: Record<string,string> = {};
            if (cfg.webhook_headers) cfg.webhook_headers.split('\n').forEach((l: string) => { const i = l.indexOf(':'); if (i>0) headers[l.slice(0,i).trim()]=l.slice(i+1).trim(); });
            if (cfg.webhook_method === 'POST') headers['Content-Type'] = cfg.webhook_content_type === 'json' ? 'application/json' : 'text/plain';
            console.log('[Webhook-Agent] 上线通知:', fullAgent.name);
            const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
            const r = await fetch(cfg.webhook_url, { method: cfg.webhook_method||'POST', headers, body: cfg.webhook_method!=='GET'?body:undefined, signal: ctrl.signal });
            clearTimeout(t);
            console.log('[Webhook-Agent] 结果:', r.status);
          }
        } catch (e: any) { console.error('[Webhook-Agent] 上线通知失败:', e.message); }
      }
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

import { getRequestListener } from '@hono/node-server';
import { createServer } from 'http';
const port = parseInt(process.env.PORT || config.port || '7860');
const host = process.env.HOSTNAME || config.hostname || '0.0.0.0';

let broadcast = (type: string, data: any) => {};

// Throttled broadcast: collect pending agent IDs and flush at most once per second
const pendingBroadcasts = new Set<number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 1000;

function flushBroadcasts() {
  flushTimer = null;
  if (pendingBroadcasts.size === 0) return;
  const ids = Array.from(pendingBroadcasts);
  pendingBroadcasts.clear();
  const msg = `event: agent-update
data: ${JSON.stringify({ ids, time: new Date().toISOString() })}

`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { sseClients.delete(res); }
  }
}

const listener = getRequestListener(app.fetch);

// SSE clients (ServerResponse objects kept open for streaming)
const sseClients = new Set<any>();

const server = createServer((req, res) => {
  // SSE endpoint — works through any proxy, no special upgrade needed
  if (req.url === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });
    sseClients.add(res);
    res.write('event: connected\ndata: {}\n\n');
    console.log('SSE client connected, total:', sseClients.size);
    req.on('close', () => {
      sseClients.delete(res);
      console.log('SSE client disconnected, remaining:', sseClients.size);
    });
    return;
  }
  return listener(req, res);
});

// Override broadcast — queue agent IDs and flush throttled
broadcast = (type, data) => {
  if (data?.id) {
    pendingBroadcasts.add(data.id);
    if (!flushTimer) {
      flushTimer = setTimeout(flushBroadcasts, FLUSH_INTERVAL_MS);
    }
  }
};

(async () => {
  const initResult = await checkAndInitializeDatabase(env);
  console.log('DB init:', initResult.message);

  server.listen(port, host, () => {
    console.log(`Xugou Node.js backend on http://${host}:${port}`);
  });
})();

setInterval(async () => {
  try { await runScheduledTasks(null, env, {}); }
  catch (e) { console.error('Scheduled task error:', e); }
}, 60 * 1000);

process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });
