import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Cross2Icon } from '@radix-ui/react-icons';
import { TerminalIcon } from 'lucide-react';
import { ENV_API_BASE_URL } from '../config';

interface TerminalModalProps {
  agentId: number;
  agentName: string;
  token: string;
  onClose: () => void;
}

export default function TerminalModal({ agentId, agentName, token, onClose }: TerminalModalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const termRefObj = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!termRef.current) return;

    const base = ENV_API_BASE_URL || '';
    const wsBase = base.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/ws/terminal?agentId=${agentId}&token=${encodeURIComponent(token)}`;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
        selectionBackground: '#585b7066',
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);

    const doFit = () => {
      setTimeout(() => {
        try { fitAddon.fit(); } catch {}
      }, 50);
    };
    doFit();

    const resizeObserver = new ResizeObserver(() => doFit());
    if (termRef.current.parentElement) {
      resizeObserver.observe(termRef.current.parentElement);
    }

    termRefObj.current = term;

    let ws: WebSocket | null = null;
    let reconnectCount = 0;
    const MAX_RECONNECT = 10;

    const connectWS = () => {
      if (reconnectCount >= MAX_RECONNECT) {
        term.write('\r\n\x1b[31m✕ 重连次数过多，请关闭重新打开\x1b[0m\r\n');
        setStatus('disconnected');
        return;
      }

      setStatus('connecting');
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectCount = 0;
          setStatus('connected');
          term.write('\r\n\x1b[32m✓ 终端连接已建立\x1b[0m\r\n');
          term.focus();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'shell-output') {
              term.write(msg.data || '');
            } else if (msg.type === 'shell-exit') {
              term.write(`\r\n\x1b[33m进程已退出 (code: ${msg.code ?? '?'})\x1b[0m\r\n`);
            } else if (msg.type === 'error') {
              term.write(`\r\n\x1b[31m${msg.message || '未知错误'}\x1b[0m\r\n`);
            }
          } catch {
            term.write(event.data);
          }
        };

        ws.onclose = () => {
          setStatus('disconnected');
          reconnectCount++;
          const delay = Math.min(2000 * reconnectCount, 10000);
          term.write(`\r\n\x1b[33m⚠ 终端已断开，${delay/1000}秒后重连 (${reconnectCount}/${MAX_RECONNECT})\x1b[0m\r\n`);
          reconnectTimerRef.current = setTimeout(connectWS, delay);
        };

        ws.onerror = () => {
          setStatus('disconnected');
        };
      } catch (e) {
        setStatus('disconnected');
        term.write(`\r\n\x1b[31m✕ WebSocket 创建失败: ${e}\x1b[0m\r\n`);
      }
    };

    connectWS();

    const disposable = term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'shell-input', data }));
      }
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    term.focus();

    return () => {
      disposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      ws?.close();
      term.dispose();
    };
  }, [agentId, token]);

  const statusColor = status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-red-500';
  const statusText = status === 'connected' ? '已连接' : status === 'connecting' ? '连接中...' : '已断开';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-4xl glass rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#11111b] border-b border-white/[0.06]">
          <TerminalIcon size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white truncate">{agentName}</span>
          <span className="flex items-center gap-1.5 text-xs text-slate-400 ml-auto">
            <span className={`w-2 h-2 rounded-full ${statusColor}`} />
            {statusText}
          </span>
          <button onClick={onClose}
            className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors">
            <Cross2Icon className="w-4 h-4" />
          </button>
        </div>

        {/* Terminal container */}
        <div
          ref={termRef}
          className="w-full h-[50vh] min-h-[300px]"
          style={{ background: '#1a1b2e' }}
        />
      </div>
    </div>
  );
}
