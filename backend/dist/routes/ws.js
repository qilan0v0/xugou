"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocketServer = setupWebSocketServer;
const ws_1 = __importDefault(require("ws"));
const jsonwebtoken_1 = require("jsonwebtoken");
const agentWsMap = new Map();
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
    const wss = new ws_1.default.Server({ server });
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname;
        if (path === '/api/ws/agent')
            handleAgentConnection(ws, url, env);
        else if (path === '/api/ws/terminal')
            handleTerminalConnection(ws, url, env);
        else
            ws.close(4004, 'unknown path');
    });
    console.log('[WS] Server ready');
    return wss;
}
// ── Agent 连接 ──
function handleAgentConnection(ws, url, env) {
    const token = url.searchParams.get('token');
    if (!token) {
        ws.close(4001, 'missing token');
        return;
    }
    try {
        const agent = env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first();
        if (!agent) {
            ws.close(4003, 'invalid token');
            return;
        }
        const agentId = agent.id;
        agentWsMap.set(agentId, ws);
        console.log(`[WS] Agent ${agentId} connected`);
        ws.on('close', () => {
            agentWsMap.delete(agentId);
            console.log(`[WS] Agent ${agentId} disconnected`);
        });
        ws.on('error', () => agentWsMap.delete(agentId));
    }
    catch (e) {
        console.error('[WS] Agent auth error:', e);
        ws.close(4002, 'auth error');
    }
}
// ── 前端终端连接 ──
function handleTerminalConnection(ws, url, env) {
    const token = url.searchParams.get('token');
    const agentIdStr = url.searchParams.get('agentId');
    if (!token || !agentIdStr) {
        ws.close(4001, 'missing token or agentId');
        return;
    }
    const user = verifyJWT(token, env.JWT_SECRET);
    if (!user) {
        console.log(`[WS] Terminal auth failed for token starting with: ${token?.slice(0, 10)}...`);
        ws.close(4003, 'unauthorized');
        return;
    }
    const agentId = parseInt(agentIdStr, 10);
    if (isNaN(agentId)) {
        ws.close(4004, 'invalid agentId');
        return;
    }
    console.log(`[WS] Terminal: user=${user.id} → agent=${agentId}`);
    // 等待 agent 在线（最多 10 秒）
    let retries = 0;
    const tryBridge = () => {
        const agentWs = agentWsMap.get(agentId);
        if (agentWs && agentWs.readyState === ws_1.default.OPEN) {
            // 建立桥接
            agentWs.send(JSON.stringify({ type: 'shell-start' }));
            let alive = true;
            const fwdToAgent = (data) => {
                if (!alive || agentWs.readyState !== ws_1.default.OPEN)
                    return;
                try {
                    agentWs.send(JSON.stringify({ type: 'shell-input', data: JSON.parse(data.toString()).data || '' }));
                }
                catch {
                    agentWs.send(data.toString());
                }
            };
            const fwdToFrontend = (data) => {
                if (!alive || ws.readyState !== ws_1.default.OPEN)
                    return;
                try {
                    const m = JSON.parse(data.toString());
                    if (m.type === 'shell-output' || m.type === 'shell-exit')
                        ws.send(data.toString());
                }
                catch { /* ignore */ }
            };
            ws.on('message', fwdToAgent);
            agentWs.on('message', fwdToFrontend);
            const cleanup = () => {
                if (!alive)
                    return;
                alive = false;
                ws.removeListener('message', fwdToAgent);
                agentWs.removeListener('message', fwdToFrontend);
            };
            ws.on('close', () => { cleanup(); console.log(`[WS] Bridge closed: agent=${agentId}`); });
            ws.on('error', cleanup);
            // Agent 断线后不关前端连接，等待重连后自动恢复
            const onAgentClose = function () {
                console.log(`[WS] Agent ${agentId} lost, waiting before retry...`);
                ws.removeListener('message', fwdToAgent);
                let alive2 = true;
                const waitAndRebridge = () => {
                    if (!alive2 || ws.readyState !== ws_1.default.OPEN)
                        return;
                    const newAgentWs = agentWsMap.get(agentId);
                    if (newAgentWs && newAgentWs.readyState === ws_1.default.OPEN && newAgentWs !== agentWs) {
                        agentWs = newAgentWs;
                        cleanup();
                        alive2 = false;
                        console.log(`[WS] Agent ${agentId} reconnected, rebridging...`);
                        newAgentWs.send(JSON.stringify({ type: 'shell-start' }));
                        ws.on('message', fwdToAgent);
                        newAgentWs.on('message', fwdToFrontend);
                        newAgentWs.on('close', onAgentClose);
                        return;
                    }
                    setTimeout(waitAndRebridge, 2000);
                };
                setTimeout(waitAndRebridge, 2000);
            };
            agentWs.on('close', onAgentClose);
            return;
        }
        retries++;
        if (retries >= 10 || ws.readyState !== ws_1.default.OPEN) {
            ws.close(4006, 'agent offline');
            return;
        }
        setTimeout(tryBridge, 1000);
    };
    tryBridge();
}
