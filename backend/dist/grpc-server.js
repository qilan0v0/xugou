"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGrpcServer = startGrpcServer;
const grpc = __importStar(require("@grpc/grpc-js"));
const protoLoader = __importStar(require("@grpc/proto-loader"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const PROTO_PATH = path_1.default.join(__dirname, 'nezha.proto');
const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
});
const nezhaProto = grpc.loadPackageDefinition(packageDef);
// Import shared utilities (same as index.node.ts)
const jwt_1 = require("./utils/jwt");
const tasks_1 = require("./tasks");
function startGrpcServer(env, broadcast, countryCache) {
    const server = new grpc.Server();
    // ── ReportSystemInfo — Host info (unary, used by Nezha v0/v1) ──
    server.addService(nezhaProto.proto.NezhaService.service, {
        ReportSystemInfo: async (call, callback) => {
            try {
                const host = call.request;
                const metadata = call.metadata.getMap();
                const token = (metadata['client_secret'] || metadata['client-secret'] || '');
                if (!token) {
                    callback(null, { proceed: false });
                    return;
                }
                await processNezhaHost(env, token, host, countryCache, broadcast);
                callback(null, { proceed: true });
            }
            catch (e) {
                console.error('[gRPC] ReportSystemInfo error:', e.message);
                callback(null, { proceed: false });
            }
        },
        // ── ReportSystemInfo2 — Host info v2 (unary, returns dashboard boot time) ──
        ReportSystemInfo2: async (call, callback) => {
            try {
                const host = call.request;
                const metadata = call.metadata.getMap();
                const token = (metadata['client_secret'] || metadata['client-secret'] || '');
                if (!token) {
                    callback(null, { data: 0 });
                    return;
                }
                await processNezhaHost(env, token, host, countryCache, broadcast);
                callback(null, { data: Math.floor(Date.now() / 1000) });
            }
            catch (e) {
                console.error('[gRPC] ReportSystemInfo2 error:', e.message);
                callback(null, { data: 0 });
            }
        },
        // ── ReportSystemState — State streaming (bidirectional) ──
        ReportSystemState: async (call) => {
            const metadata = call.metadata.getMap();
            const token = (metadata['client_secret'] || metadata['client-secret'] || '');
            call.on('data', async (state) => {
                try {
                    await processNezhaState(env, token, state, countryCache, broadcast);
                    call.write({ proceed: true });
                }
                catch (e) {
                    console.error('[gRPC] ReportSystemState error:', e.message);
                    call.write({ proceed: false });
                }
            });
            call.on('end', () => {
                call.end();
            });
        },
        // ── Stub handlers for other RPCs ──
        RequestTask: (call) => { call.end(); },
        IOStream: (call) => { call.end(); },
        ReportGeoIP: (call, callback) => {
            callback(null, call.request || {});
        },
    });
    const grpcPort = parseInt(process.env.GRPC_PORT || '5413');
    const grpcHost = process.env.GRPC_HOST || '0.0.0.0';
    // Load or generate TLS certificate
    const certDir = __dirname;
    let certPath = path_1.default.join(certDir, 'grpc-cert.pem');
    let keyPath = path_1.default.join(certDir, 'grpc-key.pem');
    let credentials;
    try {
        const cert = (0, fs_1.readFileSync)(certPath);
        const key = (0, fs_1.readFileSync)(keyPath);
        credentials = grpc.ServerCredentials.createSsl(null, [{ private_key: key, cert_chain: cert }]);
        console.log('[gRPC] Using TLS from', certPath);
    }
    catch {
        // Fallback to insecure if no cert files
        credentials = grpc.ServerCredentials.createInsecure();
        console.log('[gRPC] No TLS cert found, falling back to insecure');
    }
    return new Promise((resolve, reject) => {
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
async function processNezhaHost(env, token, host, countryCache, broadcast) {
    // Map Nezha Host fields to qltz fields
    const cpuModelName = (0, jwt_1.toD1Primitive)(Array.isArray(host.cpu) ? host.cpu.join(', ') : host.cpu ?? null);
    const cpuCores = Array.isArray(host.cpu) ? host.cpu.length : null;
    const cpuArch = (0, jwt_1.toD1Primitive)(host.arch ?? null);
    const os = (0, jwt_1.toD1Primitive)(host.platform ?? null);
    const version = (0, jwt_1.toD1Primitive)(host.platform_version ?? host.version ?? null);
    const bootTimeUnix = host.boot_time ?? null;
    const bt = bootTimeUnix ? new Date(bootTimeUnix * 1000).toISOString() : null;
    const av = (0, jwt_1.toD1Primitive)(host.version ?? null);
    const memTotal = host.mem_total ?? null;
    const diskTotal = host.disk_total ?? null;
    // These are set by processNezhaState, but we need them for the DB update.
    // Store them in a temporary map keyed by token for the state handler to use.
    if (!gNezhaHostCache.has(token))
        gNezhaHostCache.set(token, {});
    const cached = gNezhaHostCache.get(token);
    cached.cpuModelName = cpuModelName;
    cached.cpuCores = cpuCores;
    cached.cpuArch = cpuArch;
    cached.os = os;
    cached.version = version;
    cached.bt = bt;
    cached.av = av;
    cached.memTotal = memTotal;
    cached.diskTotal = diskTotal;
    // Also do a full update when host data arrives
    await agentUpdate(env, token, {
        cpu: null, memTotal, memUsed: null,
        diskTotal, diskUsed: null,
        netRx: null, netTx: null,
        netRxTotal: null, netTxTotal: null,
        cpuModelName, cpuCores, cpuArch, os, version,
        l1: null, l5: null, l15: null,
        bt, av,
        hostname: null, ipAddress: null,
        processCount: null, tcpCount: null, udpCount: null,
        country: null,
        raw: JSON.stringify(host),
    }, countryCache, broadcast);
}
// Cache Nezha host info between host and state reports
const gNezhaHostCache = new Map();
// ── Nezha State → qltz agent update ──
async function processNezhaState(env, token, state, countryCache, broadcast) {
    const cached = gNezhaHostCache.get(token) || {};
    await agentUpdate(env, token, {
        cpu: state.cpu ?? null,
        memTotal: cached.memTotal ?? null,
        memUsed: state.mem_used ?? null,
        diskTotal: cached.diskTotal ?? null,
        diskUsed: state.disk_used ?? null,
        netRxTotal: state.net_in_transfer ?? null,
        netTxTotal: state.net_out_transfer ?? null,
        netRx: state.net_in_speed != null ? state.net_in_speed / 1024 : null,
        netTx: state.net_out_speed != null ? state.net_out_speed / 1024 : null,
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
        processCount: state.process_count ?? null,
        tcpCount: state.tcp_conn_count ?? null,
        udpCount: state.udp_conn_count ?? null,
        country: null,
        raw: JSON.stringify(state),
    }, countryCache, broadcast);
}
async function agentUpdate(env, token, f, countryCache, broadcast) {
    // Look up / create agent
    let agent = await env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first();
    let isNewAgent = false;
    if (!agent) {
        const adminUser = env.DB.prepare('SELECT id FROM users WHERE role = ?').bind('admin').first();
        if (!adminUser)
            return;
        const autoName = (0, jwt_1.generateAgentName)(f.country || undefined);
        const now2 = new Date().toISOString();
        env.DB.prepare(`INSERT INTO agents (name, token, created_by, status, created_at, updated_at, connected_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`).bind(autoName, token, adminUser.id, now2, now2, now2).run();
        agent = env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first();
        if (!agent)
            return;
        isNewAgent = true;
        console.log(`[gRPC] Agent auto-created: id=${agent.id}`);
    }
    // Network rate fallback: calc from delta if rate not provided
    let netRx = f.netRx;
    let netTx = f.netTx;
    if ((netRx == null || netRx === 0) && f.netRxTotal != null) {
        const prev = env.DB.prepare('SELECT network_rx_total, network_tx_total, updated_at FROM agents WHERE id = ?').bind(agent.id).first();
        if (prev && prev.network_rx_total != null) {
            const elapsed = (Date.now() - new Date(prev.updated_at).getTime()) / 1000;
            if (elapsed > 0 && elapsed < 3600) {
                netRx = Math.max(0, (f.netRxTotal - (prev.network_rx_total || 0)) / elapsed / 1024);
                netTx = Math.max(0, (f.netTxTotal - (prev.network_tx_total || 0)) / elapsed / 1024);
            }
        }
    }
    const now = new Date().toISOString();
    const prev = await env.DB.prepare('SELECT status, updated_at, connected_at, boot_time FROM agents WHERE id = ?').bind(agent.id).first();
    const currentStatus = prev?.status;
    const gapMs = prev?.updated_at ? Date.now() - new Date(prev.updated_at).getTime() : 0;
    const wasInactive = isNewAgent || (currentStatus === 'inactive') || (gapMs > 120000 && gapMs < 240000 && (!currentStatus || currentStatus !== 'active')) || (!currentStatus && !prev?.connected_at);
    const connMissing = !prev?.connected_at;
    const bootChanged = prev?.boot_time && f.bt && prev.boot_time !== f.bt;
    const wasOffline = currentStatus === 'inactive' || (gapMs > 0 && !isNaN(gapMs) && gapMs > 120000) || !!bootChanged;
    const shouldReset = isNewAgent || connMissing || wasOffline;
    const newConnectedAt = shouldReset ? now : (prev?.connected_at || now);
    const result = env.DB.prepare(`UPDATE agents SET status='active', connected_at=?, cpu_usage=?, memory_total=?, memory_used=?, disk_total=?, disk_used=?, network_rx=?, network_tx=?, hostname=?, ip_address=?, os=?, version=?, cpu_arch=?, cpu_model_name=?, cpu_cores=?, load1=?, load5=?, load15=?, boot_time=?, network_rx_total=?, network_tx_total=?, agent_version=?, country=?, updated_at=?, last_payload=?, process_count=?, tcp_count=?, udp_count=? WHERE id=?`).bind(newConnectedAt, f.cpu, f.memTotal, f.memUsed, f.diskTotal, f.diskUsed, netRx, netTx, f.hostname, f.ipAddress, f.os, f.version, f.cpuArch, f.cpuModelName, f.cpuCores, f.l1, f.l5, f.l15, f.bt, f.netRxTotal, f.netTxTotal, f.av, f.country, now, f.raw.slice(0, 2000), f.processCount, f.tcpCount, f.udpCount, agent.id).run();
    if (!result.success) {
        console.error('[gRPC] Update failed:', result.error);
        return;
    }
    // Metrics history
    try {
        const memPctVal = (f.memTotal && f.memUsed) ? (f.memUsed / f.memTotal * 100) : null;
        const diskPctVal = (f.diskTotal && f.diskUsed) ? (f.diskUsed / f.diskTotal * 100) : null;
        env.DB.prepare('INSERT INTO agent_metrics_history (agent_id, timestamp, cpu, mem_pct, disk_pct, net_rx, net_tx, process_count, tcp_count, udp_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(agent.id, now, f.cpu, memPctVal, diskPctVal, netRx, netTx, f.processCount, f.tcpCount, f.udpCount).run();
        env.DB.prepare('DELETE FROM agent_metrics_history WHERE agent_id = ? AND id NOT IN (SELECT id FROM agent_metrics_history WHERE agent_id = ? ORDER BY id DESC LIMIT 2880)').bind(agent.id, agent.id).run();
    }
    catch (e) { /* non-critical */ }
    // Auto-renewal
    try {
        const agentForRenew = env.DB.prepare('SELECT expiry_time, duration_value, duration_unit FROM agents WHERE id = ?').bind(agent.id).first();
        if (agentForRenew?.expiry_time && agentForRenew?.duration_value && agentForRenew?.duration_unit) {
            if (new Date() > new Date(agentForRenew.expiry_time)) {
                const newExpiry = (0, jwt_1.addDuration)(new Date(), agentForRenew.duration_value, agentForRenew.duration_unit);
                env.DB.prepare('UPDATE agents SET start_time = ?, expiry_time = ? WHERE id = ?').bind(new Date().toISOString(), newExpiry.toISOString(), agent.id).run();
            }
        }
    }
    catch (e) { /* non-critical */ }
    // Online notification
    if (wasInactive) {
        const fullAgent = env.DB.prepare('SELECT * FROM agents WHERE id = ?').bind(agent.id).first();
        if (fullAgent) {
            (0, tasks_1.sendAgentNotification)(env, fullAgent, 'up').catch(() => { });
        }
    }
    broadcast?.('agent-update', { id: agent.id });
}
