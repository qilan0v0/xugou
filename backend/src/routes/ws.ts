import WebSocket from 'ws';
import { verify, JwtPayload } from 'jsonwebtoken';
import { IncomingMessage } from 'http';

// Agent WebSocket 连接池: agentId → WebSocket
const agentWsMap = new Map<number, WebSocket>();
const agentTokenMap = new Map<string, number>(); // token → agentId

// 验证 JWT token (前端用)
function verifyJWT(token: string, secret: string): { id: number; role: string } | null {
  try {
    const decoded = verify(token, secret) as JwtPayload & { id: number; role: string };
    return decoded.role === 'admin' ? { id: decoded.id, role: decoded.role } : null;
  } catch {
    return null;
  }
}

// 安装 WebSocket 服务器
export function setupWebSocketServer(server: any, env: { DB: any; JWT_SECRET: string }) {
  const wss = new WebSocket.Server({ server, path: undefined });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/api/ws/agent') {
      // Agent 连接
      handleAgentConnection(ws, url, env);
    } else if (path === '/api/ws/terminal') {
      // 前端终端连接
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
  if (!token) {
    ws.close(4001, 'missing token');
    return;
  }

  // 查 token 对应的 agent ID
  try {
    const agent = env.DB.prepare('SELECT id, token FROM agents WHERE token = ?').bind(token).first() as { id: number; token: string } | null;
    if (!agent) {
      ws.close(4003, 'invalid token');
      return;
    }

    const agentId = agent.id;
    agentWsMap.set(agentId, ws);
    agentTokenMap.set(token, agentId);
    console.log(`[WS] Agent ${agentId} connected`);

    // 发送连接确认
    ws.send(JSON.stringify({ type: 'connected', agentId }));

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        // Agent 目前只需回复执行结果，不做额外处理
        // 消息直接由 bridge 转发给前端
        console.log(`[WS] Agent ${agentId} message:`, msg.type);
      } catch { /* ignore non-JSON */ }
    });

    ws.on('close', () => {
      agentWsMap.delete(agentId);
      agentTokenMap.delete(token);
      console.log(`[WS] Agent ${agentId} disconnected`);
    });

    ws.on('error', () => {
      agentWsMap.delete(agentId);
      agentTokenMap.delete(token);
    });

  } catch (e) {
    console.error('[WS] Agent auth error:', e);
    ws.close(4002, 'auth error');
  }
}

// ── 前端终端 WebSocket ──────────────────────────
function handleTerminalConnection(ws: WebSocket, url: URL, env: { JWT_SECRET: string; DB: any }) {
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

  // 查找 agent 是否在线（有 WebSocket 连接）
  const agentWs = agentWsMap.get(agentId);
  if (!agentWs || agentWs.readyState !== WebSocket.OPEN) {
    ws.close(4005, 'agent offline');
    return;
  }

  console.log(`[WS] Terminal bridge: user=${user.id} → agent=${agentId}`);

  // 通知 agent 开启 shell session
  agentWs.send(JSON.stringify({ type: 'shell-start' }));

  // 双向桥接
  const forwardToAgent = (data: WebSocket.RawData) => {
    if (agentWs.readyState === WebSocket.OPEN) {
      agentWs.send(JSON.stringify({ type: 'shell-input', data: data.toString() }));
    }
  };

  const forwardToFrontend = (data: WebSocket.RawData) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'shell-output' || msg.type === 'shell-exit') {
          ws.send(data.toString());
        }
      } catch { /* ignore */ }
    }
  };

  ws.on('message', forwardToAgent);
  agentWs.on('message', forwardToFrontend);

  // 清理
  ws.on('close', () => {
    ws.removeListener('message', forwardToAgent);
    agentWs.removeListener('message', forwardToFrontend);
    if (agentWs.readyState === WebSocket.OPEN) {
      agentWs.send(JSON.stringify({ type: 'shell-end' }));
    }
    console.log(`[WS] Terminal bridge closed: agent=${agentId}`);
  });

  agentWs.on('close', () => {
    ws.close(4006, 'agent disconnected');
  });
}
