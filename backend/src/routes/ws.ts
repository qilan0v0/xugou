import WebSocket from 'ws';
import { verify, JwtPayload } from 'jsonwebtoken';
import { IncomingMessage } from 'http';

const agentWsMap = new Map<number, WebSocket>();
const agentTokenMap = new Map<string, number>();

function verifyJWT(token: string, secret: string): { id: number; role: string } | null {
  try {
    const decoded = verify(token, secret) as JwtPayload & { id: number; role: string };
    return decoded.role === 'admin' ? { id: decoded.id, role: decoded.role } : null;
  } catch {
    return null;
  }
}

export function setupWebSocketServer(server: any, env: { DB: any; JWT_SECRET: string }) {
  const wss = new WebSocket.Server({ server, path: undefined });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/api/ws/agent') {
      handleAgentConnection(ws, url, env);
    } else if (path === '/api/ws/terminal') {
      handleTerminalConnection(ws, url, env);
    } else {
      ws.close(4004, 'unknown path');
    }
  });

  console.log('[WS] WebSocket server attached');
  return wss;
}

// ── Agent 端 WebSocket ──────────────────────────
function handleAgentConnection(ws: WebSocket, url: URL, env: { DB: any }) {
  const token = url.searchParams.get('token');
  if (!token) { ws.close(4001, 'missing token'); return; }

  try {
    const agent = env.DB.prepare('SELECT id, token FROM agents WHERE token = ?').bind(token).first() as { id: number; token: string } | null;
    if (!agent) { ws.close(4003, 'invalid token'); return; }

    const agentId = agent.id;
    agentWsMap.set(agentId, ws);
    agentTokenMap.set(token, agentId);
    console.log(`[WS] Agent ${agentId} connected`);

    // 心跳保活：收到 ping 自动回 pong，60s 无消息断开
    let alive = true;
    const heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
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
      if (alive) setTimeout(() => {
        if (alive) ws.close(4007, 'keepalive timeout');
      }, 90000);
    };

    ws.on('pong', resetKeepAlive);
    ws.on('ping', () => {
      if (ws.readyState === WebSocket.OPEN) ws.pong();
    });

    ws.on('message', (data: WebSocket.RawData) => {
      resetKeepAlive();
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'heartbeat') resetKeepAlive();
      } catch { /* ignore */ }
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
  } catch (e) {
    console.error('[WS] Agent auth error:', e);
    ws.close(4002, 'auth error');
  }
}

// ── 前端终端 WebSocket ──────────────────────────
function handleTerminalConnection(ws: WebSocket, url: URL, env: { JWT_SECRET: string; DB: any }) {
  const token = url.searchParams.get('token');
  const agentIdStr = url.searchParams.get('agentId');

  if (!token || !agentIdStr) { ws.close(4001, 'missing token or agentId'); return; }

  const user = verifyJWT(token, env.JWT_SECRET);
  if (!user) { ws.close(4003, 'unauthorized (admin required)'); return; }

  const agentId = parseInt(agentIdStr, 10);
  if (isNaN(agentId)) { ws.close(4004, 'invalid agentId'); return; }

  // 等待 agent 上线（最多等 15 秒，每 1 秒检查一次）
  let agentWs: WebSocket | null = null;
  let retries = 0;
  const maxRetries = 15;
  const waitForAgent = () => {
    agentWs = agentWsMap.get(agentId) || null;
    if (agentWs && agentWs.readyState === WebSocket.OPEN) {
      // Agent 在线，建立桥接
      console.log(`[WS] Terminal bridge: user=${user.id} → agent=${agentId}`);
      setupBridge(ws, agentWs, agentId);
      return;
    }
    retries++;
    if (retries >= maxRetries || ws.readyState !== WebSocket.OPEN) {
      ws.close(4006, 'agent offline (timeout)');
      return;
    }
    setTimeout(waitForAgent, 1000);
  };
  waitForAgent();
}

function setupBridge(ws: WebSocket, agentWsParam: WebSocket, agentId: number) {
  let agentWs = agentWsParam;
  agentWs.send(JSON.stringify({ type: 'shell-start' }));

  let bridgeAlive = true;

  const setupHandlers = () => {
    const forwardToAgent = (data: WebSocket.RawData) => {
      if (!bridgeAlive || agentWs.readyState !== WebSocket.OPEN) return;
      try {
        const msg = JSON.parse(data.toString());
        agentWs.send(JSON.stringify({ type: 'shell-input', data: msg.data || '' }));
      } catch { agentWs.send(data.toString()); }
    };

    const forwardToFrontend = (data: WebSocket.RawData) => {
      if (!bridgeAlive || ws.readyState !== WebSocket.OPEN) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'shell-output' || msg.type === 'shell-exit') {
          ws.send(data.toString());
        }
      } catch { /* ignore */ }
    };

    ws.on('message', forwardToAgent);
    agentWs.on('message', forwardToFrontend);

    return { forwardToAgent, forwardToFrontend };
  };

  let handlers = setupHandlers();

  const closeBridge = () => {
    if (!bridgeAlive) return;
    bridgeAlive = false;
    ws.removeListener('message', handlers.forwardToAgent);
    agentWs.removeListener('message', handlers.forwardToFrontend);
  };

  ws.on('close', () => {
    closeBridge();
    if (agentWs.readyState === WebSocket.OPEN) {
      agentWs.send(JSON.stringify({ type: 'shell-end' }));
    }
    console.log(`[WS] Terminal bridge closed: agent=${agentId}`);
  });

  ws.on('error', closeBridge);

  // Agent 断连时等待重连后自动恢复桥接
  agentWs.on('close', () => {
    if (!bridgeAlive) return;
    console.log(`[WS] Agent ${agentId} lost, waiting for reconnect...`);
    ws.removeListener('message', handlers.forwardToAgent);
    let retries = 0;
    const maxRetries = 30;
    const check = () => {
      retries++;
      const newAgentWs = agentWsMap.get(agentId);
      if (newAgentWs && newAgentWs.readyState === WebSocket.OPEN && newAgentWs !== agentWs) {
        agentWs = newAgentWs;
        handlers = setupHandlers();
        agentWs.send(JSON.stringify({ type: 'shell-start' }));
        // Setup close handler on new connection
        agentWs.on('close', arguments.callee);
        console.log(`[WS] Agent ${agentId} reconnected, bridge restored`);
        return;
      }
      if (!bridgeAlive || ws.readyState !== WebSocket.OPEN || retries >= maxRetries) {
        closeBridge();
        if (ws.readyState === WebSocket.OPEN) ws.close(4006, 'agent disconnected');
        return;
      }
      setTimeout(check, 2000);
    };
    setTimeout(check, 2000);
  });
}
