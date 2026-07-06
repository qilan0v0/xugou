import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { readFileSync } from 'fs';
import path from 'path';

const PROTO_PATH = path.join(__dirname, 'nezha.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: Number,
  enums: String,
  defaults: false,
  oneofs: false,
});
const nezhaProto = grpc.loadPackageDefinition(packageDef) as any;

// Import shared utilities (same as index.node.ts)
import { toD1Primitive, generateAgentName, addDuration } from './utils/jwt';
import { sendAgentNotification } from './tasks';

export function startGrpcServer(env: any, broadcast: (type: string, data: any) => void, countryCache: Map<string, string>) {
  const server = new grpc.Server();

  // Helper: extract client IP from gRPC call
  const clientIP = (call: any) => {
    try {
      const peer = call.getPeer();
      return peer.replace(/^ipv4:/, '').replace(/^ipv6:/, '').split(':')[0];
    } catch { return null; }
  };

  // ── ReportSystemInfo — Host info (unary, used by Nezha v0/v1) ──
  server.addService(nezhaProto.proto.NezhaService.service, {
    ReportSystemInfo: async (call: any, callback: any) => {
      try {
        const host = call.request;
        const metadata = call.metadata.getMap();
        const token = (metadata['client_secret'] || metadata['client-secret'] || '') as string;
        if (!token) { callback(null, { proceed: false }); return; }
        const country = await lookupCountry(clientIP(call), countryCache);
        await processNezhaHost(env, token, host, country, broadcast);
        callback(null, { proceed: true });
      } catch (e: any) {
        console.error('[gRPC] ReportSystemInfo error:', e.message);
        callback(null, { proceed: false });
      }
    },

    ReportSystemInfo2: async (call: any, callback: any) => {
      try {
        const host = call.request;
        const metadata = call.metadata.getMap();
        const token = (metadata['client_secret'] || metadata['client-secret'] || '') as string;
        if (!token) { callback(null, { data: 0 }); return; }
        const country = await lookupCountry(clientIP(call), countryCache);
        await processNezhaHost(env, token, host, country, broadcast);
        callback(null, { data: Math.floor(Date.now() / 1000) });
      } catch (e: any) {
        console.error('[gRPC] ReportSystemInfo2 error:', e.message);
        callback(null, { data: 0 });
      }
    },

    // ── ReportSystemState — State streaming (bidirectional) ──
    ReportSystemState: async (call: any) => {
      const metadata = call.metadata.getMap();
      const token = (metadata['client_secret'] || metadata['client-secret'] || '') as string;
      const country = await lookupCountry(clientIP(call), countryCache);

      call.on('data', async (state: any) => {
        try {
          await processNezhaState(env, token, state, country, broadcast);
          call.write({ proceed: true });
        } catch (e: any) {
          console.error('[gRPC] ReportSystemState error:', e.message);
          call.write({ proceed: false });
        }
      });

      call.on('end', () => {
        call.end();
      });
    },

    // ── Stub handlers for other RPCs ──
    // Keep streams open (don't call.end()), agent needs them alive
    RequestTask: (call: any) => {
      // Store for sending terminal-open tasks
      const metadata = call.metadata.getMap();
      const token = (metadata['client_secret'] || metadata['client-secret'] || '') as string;
      if (token) {
        lookupAgentIdByToken(env, token).then(agentId => {
          if (agentId) {
            gNezhaTaskStreamMap.set(agentId, call);
            call.on('close', () => { gNezhaTaskStreamMap.delete(agentId); });
            call.on('end', () => { gNezhaTaskStreamMap.delete(agentId); });
            console.log(`[gRPC] RequestTask stored for agent=${agentId}`);
            // Test: verify serialization by sending a simple task
            try {
              const testTask = { id: 1, type: 4, data: '{}' };
              call.write(testTask);
              console.log(`[gRPC] Sent test task to agent=${agentId}`);
            } catch (e: any) {
              console.log(`[gRPC] Test task write error: ${e.message}`);
            }
          }
        });
      }
      // IMPORTANT: Don't return until stream ends, otherwise @grpc/grpc-js
      // sends a "stream closed" status to the agent (causes deserialization error)
      return new Promise<void>(resolve => {
        call.on('data', () => {});
        call.on('end', () => { call.end(); resolve(); });
        call.on('close', () => resolve());
        call.on('error', () => resolve());
      });
    },
    IOStream: (call: any) => {
      // Terminal IOStream — store for bridging with frontend WS
      const metadata = call.metadata.getMap();
      const token = (metadata['client_secret'] || metadata['client-secret'] || '') as string;
      if (token) {
        lookupAgentIdByToken(env, token).then(agentId => {
          if (agentId) {
            gNezhaIOStreamMap.set(agentId, call);
            call.on('close', () => gNezhaIOStreamMap.delete(agentId));
            call.on('end', () => gNezhaIOStreamMap.delete(agentId));
            console.log(`[gRPC] IOStream stored for agent=${agentId}`);
          }
        });
      }
      call.on('data', () => {});
      call.on('end', () => {});
      return new Promise<void>(resolve => {
        call.on('end', () => { call.end(); resolve(); });
        call.on('close', () => resolve());
        call.on('error', () => resolve());
      });
    },
    ReportGeoIP: (call: any, callback: any) => {
      callback(null, call.request || {});
    },
  });

  const grpcPort = parseInt(process.env.GRPC_PORT || '5413');
  const grpcHost = process.env.GRPC_HOST || '0.0.0.0';

  // Load or generate TLS certificate
  const certDir = __dirname;
  let certPath = path.join(certDir, 'grpc-cert.pem');
  let keyPath = path.join(certDir, 'grpc-key.pem');

  let credentials: grpc.ServerCredentials;
  try {
    const cert = readFileSync(certPath);
    const key = readFileSync(keyPath);
    credentials = grpc.ServerCredentials.createSsl(null, [{ private_key: key, cert_chain: cert }]);
    console.log('[gRPC] Using TLS from', certPath);
  } catch {
    // Fallback to insecure if no cert files
    credentials = grpc.ServerCredentials.createInsecure();
    console.log('[gRPC] No TLS cert found, falling back to insecure');
  }

  return new Promise<void>((resolve, reject) => {
    server.bindAsync(`${grpcHost}:${grpcPort}`, credentials, (err, port) => {
      if (err) {
        console.error('[gRPC] Server bind error:', err.message);
        reject(err);
        return;
      }
      server.start();
      console.log(`[gRPC] Nezha server on ${grpcHost}:${port}`);
      resolve();
    });
  });
}

// ── Nezha Host → qltz agent update ──
async function processNezhaHost(env: any, token: string, host: any, country: string | null, broadcast: (type: string, data: any) => void) {
  // Map Nezha Host fields to qltz fields
  const cpuModelName = toD1Primitive(Array.isArray(host.cpu) ? host.cpu.join(', ') : host.cpu ?? null);
  const cpuCores = Array.isArray(host.cpu) ? host.cpu.length : null;
  const cpuArch = toD1Primitive(host.arch ?? null);
  const os = toD1Primitive(host.platform ?? null);
  const version = toD1Primitive(host.platformVersion ?? host.version ?? null);
  const bootTimeUnix = host.bootTime ?? null;
  const bt = bootTimeUnix ? new Date(bootTimeUnix * 1000).toISOString() : null;
  const av = toD1Primitive(host.version ?? null);
  const memTotal = host.memTotal ?? null;
  const diskTotal = host.diskTotal ?? null;

  // These are set by processNezhaState, but we need them for the DB update.
  // Store them in a temporary map keyed by token for the state handler to use.
  if (!gNezhaHostCache.has(token)) gNezhaHostCache.set(token, {});
  const cached = gNezhaHostCache.get(token)!;
  cached.cpuModelName = cpuModelName;
  cached.cpuCores = cpuCores;
  cached.cpuArch = cpuArch;
  cached.os = os;
  cached.version = version;
  cached.bt = bt;
  cached.av = av;
  cached.memTotal = memTotal;
  cached.diskTotal = diskTotal;

  // Don't call agentUpdate here — only cache the host data.
  // agentUpdate is called from processNezhaState with both host+state data,
  // avoiding overwriting state fields (memUsed, diskUsed, cpu, etc.) with null.
}

// Cache Nezha host info between host and state reports
const gNezhaHostCache = new Map<string, any>();

// ── Nezha State → qltz agent update ──
async function processNezhaState(env: any, token: string, state: any, country: string | null, broadcast: (type: string, data: any) => void) {
  const cached = gNezhaHostCache.get(token) || {};

  await agentUpdate(env, token, {
    cpu: state.cpu ?? null,
    memTotal: cached.memTotal ?? null,
    memUsed: state.memUsed ?? null,
    diskTotal: cached.diskTotal ?? null,
    diskUsed: state.diskUsed ?? null,
    netRxTotal: state.netInTransfer ?? null,
    netTxTotal: state.netOutTransfer ?? null,
    netRx: state.netInSpeed != null ? state.netInSpeed / 1024 : null,
    netTx: state.netOutSpeed != null ? state.netOutSpeed / 1024 : null,
    cpuModelName: cached.cpuModelName ?? null,
    cpuCores: cached.cpuCores ?? null,
    cpuArch: cached.cpuArch ?? null,
    os: cached.os ?? null,
    version: cached.version ?? null,
    l1: state.load1 ?? null,
    l5: state.load5 ?? null,
    l15: state.load15 ?? null,
    bt: cached.bt ?? null,
    av: cached.av ?? null,
    hostname: null,
    ipAddress: null,
    processCount: state.processCount ?? null,
    tcpCount: state.tcpConnCount ?? null,
    udpCount: state.udpConnCount ?? null,
    country: country,
    raw: JSON.stringify(state),
  }, broadcast);
}

// ── Country lookup from IP ──
async function lookupCountry(ip: string | null, cache: Map<string, string>): Promise<string | null> {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return null;
  if (cache.has(ip)) return cache.get(ip)!;
  if (cache.size >= 500) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  try {
    const res = await fetch('http://ip-api.com/json/' + ip + '?fields=countryCode');
    if (res.ok) {
      const data = await res.json() as any;
      const country = data?.countryCode || null;
      if (country) cache.set(ip, country);
      return country;
    }
  } catch {}
  return null;
}

// ── Shared agent update logic (same as /api/agents/status) ──
interface AgentFields {
  cpu: number | null;
  memTotal: number | null;
  memUsed: number | null;
  diskTotal: number | null;
  diskUsed: number | null;
  netRx: number | null;
  netTx: number | null;
  netRxTotal: number | null;
  netTxTotal: number | null;
  cpuModelName: any;
  cpuCores: number | null;
  cpuArch: any;
  os: any;
  version: any;
  l1: number | null;
  l5: number | null;
  l15: number | null;
  bt: any;
  av: any;
  hostname: any;
  ipAddress: any;
  processCount: number | null;
  tcpCount: number | null;
  udpCount: number | null;
  country: string | null;
  raw: string;
}

async function agentUpdate(env: any, token: string, f: AgentFields, broadcast: (type: string, data: any) => void) {
  // Look up / create agent
  let agent = await env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first() as { id: number } | null;
  let isNewAgent = false;
  if (!agent) {
    const adminUser = env.DB.prepare('SELECT id FROM users WHERE role = ?').bind('admin').first() as { id: number } | null;
    if (!adminUser) return;
    const autoName = generateAgentName(f.country || undefined);
    const now2 = new Date().toISOString();
    env.DB.prepare(
      `INSERT INTO agents (name, token, created_by, status, created_at, updated_at, connected_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`
    ).bind(autoName, token, adminUser.id, now2, now2, now2).run();
    agent = env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first() as { id: number } | null;
    if (!agent) return;
    isNewAgent = true;
    console.log(`[gRPC] Agent auto-created: id=${agent.id}`);
  }

  // Network rate fallback: calc from delta if rate not provided
  let netRx = f.netRx;
  let netTx = f.netTx;
  if ((netRx == null || netRx === 0) && f.netRxTotal != null) {
    const prev = env.DB.prepare('SELECT network_rx_total, network_tx_total, updated_at FROM agents WHERE id = ?').bind(agent.id).first() as any;
    if (prev && prev.network_rx_total != null) {
      const elapsed = (Date.now() - new Date(prev.updated_at).getTime()) / 1000;
      if (elapsed > 0 && elapsed < 3600) {
        netRx = Math.max(0, (f.netRxTotal - (prev.network_rx_total || 0)) / elapsed / 1024);
        netTx = Math.max(0, (f.netTxTotal - (prev.network_tx_total || 0)) / elapsed / 1024);
      }
    }
  }

  const now = new Date().toISOString();
  const prev = await env.DB.prepare('SELECT status, updated_at, connected_at, boot_time FROM agents WHERE id = ?').bind(agent.id).first() as any;
  const currentStatus = prev?.status;
  const gapMs = prev?.updated_at ? Date.now() - new Date(prev.updated_at).getTime() : 0;
  const wasInactive = isNewAgent || (currentStatus === 'inactive') || (gapMs > 120000 && gapMs < 240000 && (!currentStatus || currentStatus !== 'active')) || (!currentStatus && !prev?.connected_at);
  const connMissing = !prev?.connected_at;
  const bootChanged = prev?.boot_time && f.bt && prev.boot_time !== f.bt;
  const wasOffline = currentStatus === 'inactive' || (gapMs > 0 && !isNaN(gapMs) && gapMs > 120000) || !!bootChanged;
  const shouldReset = isNewAgent || connMissing || wasOffline;
  const newConnectedAt = shouldReset ? now : (prev?.connected_at || now);

  const result = env.DB.prepare(
    `UPDATE agents SET status='active', connected_at=?, cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, network_rx=?, network_tx=?, hostname=?, ip_address=?, os=?, version=?, cpu_arch=?, cpu_model_name=?, cpu_cores=?, load1=?, load5=?, load15=?, boot_time=?, network_rx_total=?, network_tx_total=?, agent_version=?, country=?, updated_at=?, last_payload=?, process_count=?, tcp_count=?, udp_count=? WHERE id=?`
  ).bind(
    newConnectedAt, f.cpu, f.memTotal, f.memUsed, f.diskTotal, f.diskUsed, netRx, netTx,
    f.hostname, f.ipAddress,
    f.os, f.version,
    f.cpuArch, f.cpuModelName, f.cpuCores, f.l1, f.l5, f.l15, f.bt, f.netRxTotal, f.netTxTotal, f.av,
    f.country,
    now, f.raw.slice(0, 2000),
    f.processCount, f.tcpCount, f.udpCount,
    agent.id
  ).run();

  if (!result.success) {
    console.error('[gRPC] Update failed:', result.error);
    return;
  }

  // Metrics history
  try {
    const memPctVal = (f.memTotal && f.memUsed) ? (f.memUsed / f.memTotal * 100) : null;
    const diskPctVal = (f.diskTotal && f.diskUsed) ? (f.diskUsed / f.diskTotal * 100) : null;
    env.DB.prepare(
      'INSERT INTO agent_metrics_history (agent_id, timestamp, cpu, mem_pct, disk_pct, net_rx, net_tx, process_count, tcp_count, udp_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(agent.id, now, f.cpu, memPctVal, diskPctVal, netRx, netTx, f.processCount, f.tcpCount, f.udpCount).run();
    env.DB.prepare(
      'DELETE FROM agent_metrics_history WHERE agent_id = ? AND id NOT IN (SELECT id FROM agent_metrics_history WHERE agent_id = ? ORDER BY id DESC LIMIT 2880)'
    ).bind(agent.id, agent.id).run();
  } catch (e) { /* non-critical */ }

  // Auto-renewal
  try {
    const agentForRenew = env.DB.prepare(
      'SELECT expiry_time, duration_value, duration_unit FROM agents WHERE id = ?'
    ).bind(agent.id).first() as any;
    if (agentForRenew?.expiry_time && agentForRenew?.duration_value && agentForRenew?.duration_unit) {
      if (new Date() > new Date(agentForRenew.expiry_time)) {
        const newExpiry = addDuration(new Date(), agentForRenew.duration_value, agentForRenew.duration_unit);
        env.DB.prepare(
          'UPDATE agents SET start_time = ?, expiry_time = ? WHERE id = ?'
        ).bind(new Date().toISOString(), newExpiry.toISOString(), agent.id).run();
      }
    }
  } catch (e) { /* non-critical */ }

  // Online notification
  if (wasInactive) {
    const fullAgent = env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agent.id).first() as any;
    if (fullAgent) {
      sendAgentNotification(env, fullAgent, 'up').catch(() => {});
    }
  }

  broadcast?.('agent-update', { id: agent.id });
}

// ── Exported for WS terminal bridge ──
export const gNezhaIOStreamMap = new Map<number, any>();
export const gNezhaTaskStreamMap = new Map<number, any>();

async function lookupAgentIdByToken(env: any, token: string): Promise<number | null> {
  try {
    const agent = await env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first() as { id: number } | null;
    return agent?.id ?? null;
  } catch { return null; }
}