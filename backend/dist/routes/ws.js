"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocketServer = setupWebSocketServer;
const ws_1 = __importDefault(require("ws"));
const jsonwebtoken_1 = require("jsonwebtoken");
const agentWsMap = new Map();
const agentTokenMap = new Map();
function verifyJWT(token, secret) {
    try {
        const decoded = (0, jsonwebtoken_1.verify)(token, secret);
        return decoded.role === 'admin' ? { id: decoded.id, role: decoded.role } : null;
    }
    catch {
        return null;
    }
}
function setupWebSocketServer(server, env) {
    const wss = new ws_1.default.Server({ server, path: undefined });
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname;
        if (path === '/api/ws/agent') {
            handleAgentConnection(ws, url, env);
        }
        else if (path === '/api/ws/terminal') {
            handleTerminalConnection(ws, url, env);
        }
        else {
            ws.close(4004, 'unknown path');
        }
    });
    console.log('[WS] WebSocket server attached');
    return wss;
}
// ── Agent 端 WebSocket ──────────────────────────
function handleAgentConnection(ws, url, env) {
    const token = url.searchParams.get('token');
    if (!token) {
        ws.close(4001, 'missing token');
        return;
    }
    try {
        const agent = env.DB.prepare('SELECT id, token FROM agents WHERE token = ?').bind(token).first();
        if (!agent) {
            ws.close(4003, 'invalid token');
            return;
        }
        const agentId = agent.id;
        agentWsMap.set(agentId, ws);
        agentTokenMap.set(token, agentId);
        console.log(`[WS] Agent ${agentId} connected`);
        // 心跳保活：收到 ping 自动回 pong，60s 无消息断开
        let alive = true;
        const heartbeatTimer = setInterval(() => {
            if (ws.readyState === ws_1.default.OPEN) {
                ws.ping();
            }
        }, 25000);
        const keepAliveTimer = setTimeout(() => {
            console.log(`[WS] Agent ${agentId} keepalive timeout, closing`);
            alive = false;
            ws.close(4007, 'keepalive timeout');
        }, 90000);
        const resetKeepAlive = () => {
            clearTimeout(keepAliveTimer);
            if (alive)
                setTimeout(() => {
                    if (alive)
                        ws.close(4007, 'keepalive timeout');
                }, 90000);
        };
        ws.on('pong', resetKeepAlive);
        ws.on('ping', () => {
            if (ws.readyState === ws_1.default.OPEN)
                ws.pong();
        });
        ws.on('message', (data) => {
            resetKeepAlive();
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'heartbeat')
                    resetKeepAlive();
            }
            catch { /* ignore */ }
        });
        ws.on('close', () => {
            alive = false;
            clearInterval(heartbeatTimer);
            clearTimeout(keepAliveTimer);
            agentWsMap.delete(agentId);
            agentTokenMap.delete(token);
            console.log(`[WS] Agent ${agentId} disconnected`);
        });
        ws.on('error', () => {
            alive = false;
            clearInterval(heartbeatTimer);
            clearTimeout(keepAliveTimer);
            agentWsMap.delete(agentId);
            agentTokenMap.delete(token);
        });
        ws.send(JSON.stringify({ type: 'connected', agentId }));
    }
    catch (e) {
        console.error('[WS] Agent auth error:', e);
        ws.close(4002, 'auth error');
    }
}
// ── 前端终端 WebSocket ──────────────────────────
function handleTerminalConnection(ws, url, env) {
    const token = url.searchParams.get('token');
    const agentIdStr = url.searchParams.get('agentId');
    if (!token || !agentIdStr) {
        ws.close(4001, 'missing token or agentId');
        return;
    }
    const user = verifyJWT(token, env.JWT_SECRET);
    if (!user) {
        ws.close(4003, 'unauthorized (admin required)');
        return;
    }
    const agentId = parseInt(agentIdStr, 10);
    if (isNaN(agentId)) {
        ws.close(4004, 'invalid agentId');
        return;
    }
    const agentWs = agentWsMap.get(agentId);
    if (!agentWs || agentWs.readyState !== ws_1.default.OPEN) {
        ws.close(4005, 'agent offline');
        return;
    }
    console.log(`[WS] Terminal bridge: user=${user.id} → agent=${agentId}`);
    // 通知 agent 开启 shell
    agentWs.send(JSON.stringify({ type: 'shell-start' }));
    let bridgeAlive = true;
    const forwardToAgent = (data) => {
        if (!bridgeAlive || agentWs.readyState !== ws_1.default.OPEN)
            return;
        try {
            const msg = JSON.parse(data.toString());
            agentWs.send(JSON.stringify({ type: 'shell-input', data: msg.data || '' }));
        }
        catch {
            agentWs.send(data.toString());
        }
    };
    const forwardToFrontend = (data) => {
        if (!bridgeAlive || ws.readyState !== ws_1.default.OPEN)
            return;
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'shell-output' || msg.type === 'shell-exit') {
                ws.send(data.toString());
            }
        }
        catch { /* ignore non-JSON messages */ }
    };
    ws.on('message', forwardToAgent);
    agentWs.on('message', forwardToFrontend);
    const closeBridge = () => {
        if (!bridgeAlive)
            return;
        bridgeAlive = false;
        ws.removeListener('message', forwardToAgent);
        agentWs.removeListener('message', forwardToFrontend);
    };
    ws.on('close', () => {
        closeBridge();
        if (agentWs.readyState === ws_1.default.OPEN) {
            agentWs.send(JSON.stringify({ type: 'shell-end' }));
        }
        console.log(`[WS] Terminal bridge closed: agent=${agentId}`);
    });
    ws.on('error', closeBridge);
    agentWs.on('close', () => {
        closeBridge();
        if (ws.readyState === ws_1.default.OPEN) {
            ws.close(4006, 'agent disconnected');
        }
    });
}
