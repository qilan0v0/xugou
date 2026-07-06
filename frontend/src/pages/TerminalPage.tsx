import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { TerminalIcon, Download, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ENV_API_BASE_URL } from '../config';
import FilePanel from '../components/FilePanel';

// ── Theme definitions ──
const TERMINAL_THEMES: Record<string, Record<string, string>> = {
  cyberpunk: {
    '--bg': '#0a0a0a', '--bg-surface': '#121212', '--bg-elevated': '#131313',
    '--bg-terminal': '#0a0a0a', '--text': '#4af626', '--text-muted': '#bbccb0',
    '--text-dim': '#3c4b36', '--accent': '#4af626', '--accent-secondary': '#14d1ff',
    '--border': '#1f1f1f', '--border-strong': '#3c4b36', '--error': '#ffb4ab',
    '--scrollbar-thumb': 'rgba(60, 75, 54, 0.8)',
    '--scrollbar-thumb-hover': 'rgba(134, 149, 125, 0.8)',
    termBg: '#0a0a0a', termFg: '#4af626', termCursor: '#14d1ff',
    termSel: '#273747',
  },
  glacier: {
    '--bg': '#0a192f', '--bg-surface': '#0d2137', '--bg-elevated': '#112240',
    '--bg-terminal': '#0a192f', '--text': '#64ffda', '--text-muted': '#8892b0',
    '--text-dim': '#495670', '--accent': '#64ffda', '--accent-secondary': '#e6f1ff',
    '--border': '#1d3557', '--border-strong': '#495670', '--error': '#ff6b6b',
    '--scrollbar-thumb': 'rgba(100, 255, 218, 0.2)',
    '--scrollbar-thumb-hover': 'rgba(100, 255, 218, 0.4)',
    termBg: '#0a192f', termFg: '#64ffda', termCursor: '#e6f1ff',
    termSel: '#112240',
  },
  gruvbox: {
    '--bg': '#282828', '--bg-surface': '#303030', '--bg-elevated': '#282828',
    '--bg-terminal': '#282828', '--text': '#ebdbb2', '--text-muted': '#a89984',
    '--text-dim': '#665c54', '--accent': '#b8bb26', '--accent-secondary': '#83a598',
    '--border': '#3c3836', '--border-strong': '#665c54', '--error': '#fb4934',
    '--scrollbar-thumb': 'rgba(168, 153, 132, 0.3)',
    '--scrollbar-thumb-hover': 'rgba(168, 153, 132, 0.5)',
    termBg: '#282828', termFg: '#ebdbb2', termCursor: '#d3869b',
    termSel: '#504945',
  },
};

type ThemeName = keyof typeof TERMINAL_THEMES;

export default function TerminalPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const agentName = searchParams.get('name') || `Agent #${id}`;
  const navigate = useNavigate();
  const { token: jwtToken } = useAuth();

  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);

  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [theme, setTheme] = useState<ThemeName>(() => (localStorage.getItem('qltz_term_theme') as ThemeName) || 'cyberpunk');
  const [searchVisible, setSearchVisible] = useState(false);
  const wsStateRef = useRef<WebSocket | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Apply theme CSS variables ──
  const applyTheme = useCallback((t: ThemeName) => {
    const vars = TERMINAL_THEMES[t];
    const root = document.documentElement;
    Object.entries(vars).forEach(([prop, val]) => {
      if (!prop.startsWith('term')) root.style.setProperty(prop, val);
    });
    localStorage.setItem('qltz_term_theme', t);
  }, []);

  useEffect(() => { applyTheme(theme); }, [theme, applyTheme]);

  // ── Initialize terminal ──
  useEffect(() => {
    if (!termRef.current || !jwtToken || !id) return;

    const themeVars = TERMINAL_THEMES[theme];
    const base = ENV_API_BASE_URL || '';
    const wsBase = base.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/api/ws/terminal?agentId=${id}&token=${encodeURIComponent(jwtToken)}`;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Menlo", monospace',
      theme: {
        background: themeVars.termBg,
        foreground: themeVars.termFg,
        cursor: themeVars.termCursor,
        selectionBackground: themeVars.termSel,
      },
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(new WebLinksAddon());
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    term.open(termRef.current);

    // WebGL addon with fallback
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => webgl.dispose());
      term.loadAddon(webgl);
    } catch { /* fallback to canvas */ }

    const doFit = () => setTimeout(() => { try { fitAddon.fit(); } catch {} }, 50);
    doFit();

    const resizeObserver = new ResizeObserver(() => doFit());
    if (termRef.current.parentElement) resizeObserver.observe(termRef.current.parentElement);

    terminalRef.current = term;

    // ── Search key binding ──
    term.attachCustomKeyEventHandler((e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setSearchVisible(v => !v);
        return false;
      }
      if (e.key === 'Escape') { setSearchVisible(false); return false; }
      return true;
    });

    // ── Right-click paste ──
    termRef.current.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        if (text && ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'shell-input', data: text }));
      } catch {}
    });

    // ── Drag-and-drop file (placeholder for trzsz) ──
    const cont = termRef.current!;
    cont.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    cont.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); });

    // ── WebSocket ──
    let ws: WebSocket | null = null;
    let reconnectCount = 0;
    const MAX_RECONNECT = 10;

    const connectWS = () => {
      if (reconnectCount >= MAX_RECONNECT) {
        term.write('\r\n\x1b[31m✕ 重连次数过多，请刷新重新打开\x1b[0m\r\n');
        setStatus('disconnected');
        return;
      }

      setStatus('connecting');
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        wsStateRef.current = ws;

        ws.onopen = () => {
          reconnectCount = 0;
          setStatus('connected');
          term.write('\r\n\x1b[32m✓ 终端连接已建立\x1b[0m\r\n');
          term.focus();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'shell-output') term.write(msg.data || '');
            else if (msg.type === 'shell-exit') term.write(`\r\n\x1b[33m进程已退出 (code: ${msg.code ?? '?'})\x1b[0m\r\n`);
            else if (msg.type === 'error') term.write(`\r\n\x1b[31m${msg.message || '未知错误'}\x1b[0m\r\n`);
          } catch { term.write(event.data); }
        };

        ws.onclose = (event) => {
          setStatus('disconnected');
          reconnectCount++;
          const delay = Math.min(2000 * Math.pow(1.5, reconnectCount), 15000);
          const reason = event.code ? ` (code=${event.code})` : '';
          term.write(`\r\n\x1b[33m⚠ 终端已断开${reason}，${(delay / 1000).toFixed(0)}秒后重连 (${reconnectCount}/${MAX_RECONNECT})\x1b[0m\r\n`);
          reconnectTimerRef.current = setTimeout(connectWS, delay);
        };

        ws.onerror = () => setStatus('disconnected');
      } catch (e) {
        setStatus('disconnected');
        term.write(`\r\n\x1b[31m✕ WebSocket 创建失败: ${e}\x1b[0m\r\n`);
      }
    };

    connectWS();

    const disposable = term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'shell-input', data }));
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resize', cols, rows }));
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
  }, [id, jwtToken, theme]);

  // ── Update terminal theme ──
  useEffect(() => {
    const vars = TERMINAL_THEMES[theme];
    const term = terminalRef.current;
    if (term) {
      term.options.theme = {
        background: vars.termBg,
        foreground: vars.termFg,
        cursor: vars.termCursor,
        selectionBackground: vars.termSel,
      };
    }
  }, [theme]);

  // ── Search handlers ──
  useEffect(() => {
    if (searchVisible) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [searchVisible]);

  const doSearch = (dir: 'next' | 'prev') => {
    const input = searchInputRef.current;
    if (!input?.value) return;
    if (dir === 'next') searchAddonRef.current?.findNext(input.value);
    else searchAddonRef.current?.findPrevious(input.value);
  };

  // ── Export terminal ──
  const exportLog = () => {
    const buf = terminalRef.current?.buffer.active;
    if (!buf) return;
    const lines: string[] = [];
    for (let i = 0; i < buf.length; i++) {
      const line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${agentName}_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const statusColor = status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-red-500';
  const statusText = status === 'connected' ? '已连接' : status === 'connecting' ? '连接中...' : '已断开';

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-2 shrink-0 border-b" style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        color: 'var(--text)',
      }}>
        <button onClick={() => navigate(-1)}
          className="p-1.5 rounded-md hover:opacity-80 transition-colors"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <TerminalIcon size={16} className="shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-semibold truncate">{agentName}</span>

        {/* Theme selector */}
        <select
          value={theme}
          onChange={e => setTheme(e.target.value as ThemeName)}
          className="text-xs px-2 py-1 rounded border bg-transparent outline-none cursor-pointer"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          {Object.keys(TERMINAL_THEMES).map(t => (
            <option key={t} value={t} style={{ background: 'var(--bg-elevated)', color: 'var(--text)' }}>
              {t === 'cyberpunk' ? '赛博朋克' : t === 'glacier' ? '冰川' : 'Gruvbox'}
            </option>
          ))}
        </select>

        {/* Search button */}
        <button onClick={() => setSearchVisible(v => !v)}
          className="p-1.5 rounded-md hover:opacity-80 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="搜索 (Ctrl+Shift+F)">
          <Search size={14} />
        </button>

        {/* Export button */}
        <button onClick={exportLog}
          className="p-1.5 rounded-md hover:opacity-80 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="导出日志">
          <Download size={14} />
        </button>

        <FilePanel ws={wsStateRef.current} />

        {/* Status */}
        <span className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          {statusText}
        </span>
      </div>

      {/* ── Search bar ── */}
      {searchVisible && (
        <div className="flex items-center gap-1 px-3 py-1.5 text-xs border-b shrink-0"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="搜索..."
            className="flex-1 px-2 py-1 rounded border outline-none bg-transparent text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            onKeyDown={e => {
              if (e.key === 'Enter') doSearch(e.shiftKey ? 'prev' : 'next');
            }}
          />
          <button onClick={() => doSearch('prev')} className="px-1.5 py-0.5 rounded hover:opacity-80"
            style={{ color: 'var(--accent-secondary)' }} title="上一个 (Shift+Enter)">↑</button>
          <button onClick={() => doSearch('next')} className="px-1.5 py-0.5 rounded hover:opacity-80"
            style={{ color: 'var(--accent-secondary)' }} title="下一个 (Enter)">↓</button>
          <button onClick={() => setSearchVisible(false)} className="px-1.5 py-0.5 rounded hover:opacity-80"
            style={{ color: 'var(--error)' }}>✕</button>
        </div>
      )}

      {/* ── Terminal ── */}
      <div ref={termRef} className="flex-1 min-h-0"
        style={{ background: 'var(--bg-terminal)', padding: '4px' }} />
    </div>
  );
}