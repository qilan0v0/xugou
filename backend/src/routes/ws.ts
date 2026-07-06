import WebSocket from 'ws';
import { verify, JwtPayload } from 'jsonwebtoken';
import { IncomingMessage } from 'http';
import { gNezhaIOStreamMap, gNezhaTaskStreamMap } from '../grpc-server';

const agentWsMap = new Map<number, WebSocket>();

function verifyJWT(token: string, secret: string): { id: number; role: string } | null {
  try {
    const decoded = verify(token, secret) as JwtPayload & { id: number; role: string };
    return decoded.role === 'admin' ? { id: decoded.id, role: decoded.role } : null;
  } catch { return null; }
}

export function setupWebSocketServer(server: any, env: { DB: any; JWT_SECRET: string }) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === '/api/ws/agent') handleAgentConnection(ws, url, env);
    else if (path === '/api/ws/terminal') handleTerminalConnection(ws, url, env);
    else ws.close(4004, 'unknown path');
  });

  console.log('[WS] Server ready');
  return wss;
}

// ── Agent 连接 ──
function handleAgentConnection(ws: WebSocket, url: URL, env: { DB: any }) {
  const token = url.searchParams.get('token');
  if (!token) { ws.close(4001, 'missing token'); return; }

  try {
    const agent = env.DB.prepare('SELECT id FROM agents WHERE token = ?').bind(token).first() as { id: number } | null;
    if (!agent) { ws.close(4003, 'invalid token'); return; }

    const agentId = agent.id;
    agentWsMap.set(agentId, ws);
    console.log(`[WS] Agent ${agentId} connected`);

    ws.on('close', (code?: number) => {
      agentWsMap.delete(agentId);
      console.log(`[WS] Agent ${agentId} disconnected code=${code ?? 'none'}`);
    });
    ws.on('error', (err: Error) => {
      console.log(`[WS] Agent ${agentId} error: ${err.message}`);
      agentWsMap.delete(agentId);
    });
  } catch (e) {
    console.error('[WS] Agent auth error:', e);
    ws.close(4002, 'auth error');
  }
}

// ── 前端终端连接 ──
function handleTerminalConnection(ws: WebSocket, url: URL, env: { JWT_SECRET: string; DB: any }) {
  const token = url.searchParams.get('token');
  const agentIdStr = url.searchParams.get('agentId');
  if (!token || !agentIdStr) { ws.close(4001, 'missing token or agentId'); return; }

  const user = verifyJWT(token, env.JWT_SECRET);
  if (!user) { 
    console.log(`[WS] Terminal auth failed for token starting with: ${token?.slice(0, 10)}...`);
    ws.close(4003, 'unauthorized'); 
    return; 
  }

  const agentId = parseInt(agentIdStr, 10);
  if (isNaN(agentId)) { ws.close(4004, 'invalid agentId'); return; }

  console.log(`[WS] Terminal: user=${user.id} → agent=${agentId}`);

  // 等待 agent 在线（最多 10 秒）
  let retries = 0;
  let grpcStream: any = null;
  let taskSent = false;
  const tryBridge = async () => {
    // 先查 WebSocket agent 连接
    let agentWs = agentWsMap.get(agentId);
    if (agentWs && agentWs.readyState === WebSocket.OPEN) {
      // 建立桥接
      agentWs.send(JSON.stringify({ type: 'shell-start' }));

      let alive = true;
      const fwdToAgent = (data: WebSocket.RawData) => {
        if (!alive || agentWs.readyState !== WebSocket.OPEN) return;
        try { agentWs.send(JSON.stringify({ type: 'shell-input', data: JSON.parse(data.toString()).data || '' })); }
        catch { agentWs.send(data.toString()); }
      };
      const fwdToFrontend = (data: WebSocket.RawData) => {
        if (!alive || ws.readyState !== WebSocket.OPEN) return;
        try {
          const m = JSON.parse(data.toString());
          if (m.type === 'shell-output' || m.type === 'shell-exit') ws.send(data.toString());
        } catch { /* ignore */ }
      };

      ws.on('message', fwdToAgent);
      agentWs.on('message', fwdToFrontend);

      const cleanup = () => {
        if (!alive) return;
        alive = false;
        ws.removeListener('message', fwdToAgent);
        agentWs.removeListener('message', fwdToFrontend);
      };

      ws.on('close', (code?: number, reason?: Buffer) => {
        cleanup();
        console.log(`[WS] Bridge closed: agent=${agentId} code=${code ?? 'none'} reason=${reason?.toString() || 'none'}`);
        // 通知 agent 关闭 shell，避免进程泄漏
        if (agentWs.readyState === WebSocket.OPEN) {
          try { agentWs.send(JSON.stringify({ type: 'shell-end' })); } catch { /* ignore */ }
        }
      });
      ws.on('error', (err: Error) => {
        console.log(`[WS] Bridge error: agent=${agentId} msg=${err.message}`);
        cleanup();
      });
      
      // Agent 断线后不关前端连接，等待重连后自动恢复
      const onAgentClose = function() {
        console.log(`[WS] Agent ${agentId} lost, waiting before retry...`);
        ws.removeListener('message', fwdToAgent);
        let alive2 = true;
        const waitAndRebridge = () => {
          if (!alive2 || ws.readyState !== WebSocket.OPEN) return;
          const newAgentWs = agentWsMap.get(agentId);
          if (newAgentWs && newAgentWs.readyState === WebSocket.OPEN && newAgentWs !== agentWs) {
            (agentWs as any) = newAgentWs;
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

    // 尝试 Nezha gRPC IOStream 桥接
    grpcStream = gNezhaIOStreamMap.get(agentId);
    console.log(`[WS] Bridge attempt: agent=${agentId} retry=${retries}`);
    console.log(`[WS]   agentWsMap=${gNezhaIOStreamMap.has(agentId) ? 'found' : 'none'} taskStream=${gNezhaTaskStreamMap.has(agentId) ? 'found' : 'none'} ioStream=${gNezhaIOStreamMap.has(agentId) ? 'found' : 'none'}`);
    if (!grpcStream) {
      // IOStream 还没打开，通过 RequestTask 触发
      const taskStream = gNezhaTaskStreamMap.get(agentId);
      if (taskStream && !taskSent) {
        taskSent = true;
        console.log(`[WS] Sending terminal task to agent=${agentId}`);
        try {
          taskStream.write({ id: Date.now(), type: 4, data: '{"protocol":"raw","exec":"/bin/sh"}' });
        } catch (e: any) {
          console.log(`[WS] Task write error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3000));
        grpcStream = gNezhaIOStreamMap.get(agentId);
      }
    }
    if (grpcStream) {
      console.log(`[WS] Terminal: gRPC IOStream bridge for agent=${agentId}`);
      let alive = true;
      const cleanup = () => { alive = false; };

      ws.on('message', (data: WebSocket.RawData) => {
        if (!alive) return;
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'shell-input') {
            grpcStream.write({ data: Buffer.from(msg.data || '') });
          }
        } catch {}
      });

      grpcStream.on('data', (ioData: any) => {
        if (!alive || ws.readyState !== WebSocket.OPEN) return;
        const output = ioData.data;
        if (output && output.length > 0) {
          ws.send(JSON.stringify({ type: 'shell-output', data: output.toString() }));
        }
      });

      ws.on('close', () => cleanup());
      ws.on('error', cleanup);
      console.log(`[WS] gRPC bridge established: agent=${agentId}`);
      return;
    }

    retries++;
    if (retries >= 10 || ws.readyState !== WebSocket.OPEN) {
      ws.close(4006, 'agent offline');
      return;
    }
    setTimeout(tryBridge, 1000);
  };

  tryBridge();
}
