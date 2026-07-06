import { useState, useRef, useEffect, useCallback } from 'react';
import { FolderIcon, FileIcon, Upload, Download, Trash2, RotateCw, Home, ArrowLeft, Plus, Edit3 } from 'lucide-react';

interface FileEntry {
  name: string;
  size: number;
  mode: string;
  modTime: string;
  isDir: boolean;
}

interface FilePanelProps {
  ws: WebSocket | null;
}

const FILE_ICONS: Record<string, string> = {
  js: '📜', ts: '📘', json: '📋', md: '📝',
  py: '🐍', go: '🔵', sh: '⚡', yml: '⚙️', yaml: '⚙️',
  txt: '📄', log: '📋', csv: '📊',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
  mp4: '🎬', mp3: '🎵', zip: '📦', tar: '📦', gz: '📦',
  pdf: '📕', doc: '📃',
};

function getFileIcon(name: string, isDir: boolean): string {

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

export default function FilePanel({ ws }: FilePanelProps) {
  const [visible, setVisible] = useState(false);
  const [path, setPath] = useState('/');
  const [history, setHistory] = useState<string[]>(['/']);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<((data: any) => void) | null>(null);

  // Listen for file operation responses
  useEffect(() => {
    if (!ws) return;
    const handler = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-list-result') {
          try {
            const data = JSON.parse(msg.data);
            setEntries(data.entries || []);
          } catch { setEntries(msg.entries || []); }
          setLoading(false);
        } else if (msg.type === 'file-error') {
          setLoading(false);
          alert(msg.data);
        }
        if (pendingRef.current) {
          pendingRef.current(msg);
          pendingRef.current = null;
        }
      } catch {}
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws]);

  const send = useCallback((type: string, data?: any) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data: data || '' }));
    }
  }, [ws]);

  const navigate = useCallback((dir: string) => {
    const newPath = dir === '..' ? path.split('/').slice(0, -1).join('/') || '/' : path === '/' ? '/' + dir : path + '/' + dir;
    // Normalize
    const normalized = newPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    setPath(normalized);
    setSelected(null);
    setLoading(true);
    send('file-list', normalized);
    // Update history
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(normalized);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
  }, [path, history, historyIdx, send]);

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      setPath(history[newIdx]);
      setSelected(null);
      setLoading(true);
      send('file-list', history[newIdx]);
    }
  }, [history, historyIdx, send]);

  const goForward = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const newIdx = historyIdx + 1;
      setHistoryIdx(newIdx);
      setPath(history[newIdx]);
      setSelected(null);
      setLoading(true);
      send('file-list', history[newIdx]);
    }
  }, [history, historyIdx, send]);

  const goHome = useCallback(() => {
    setPath('/');
    setSelected(null);
    setLoading(true);
    send('file-list', '/');
    setHistory(['/']);
    setHistoryIdx(0);
  }, [send]);

  const refresh = useCallback(() => {
    setLoading(true);
    send('file-list', path);
  }, [path, send]);

  const deleteItem = useCallback((name: string) => {
    const full = path === '/' ? '/' + name : path + '/' + name;
    if (!confirm(`确认删除 ${name}？`)) return;
    send('file-delete', full);
    setTimeout(refresh, 300);
  }, [path, send, refresh]);

  const renameItem = useCallback((oldName: string) => {
    const newName = prompt('新名称:', oldName);
    if (!newName || newName === oldName) return;
    const oldPath = path === '/' ? '/' + oldName : path + '/' + oldName;
    const newPath = path === '/' ? '/' + newName : path + '/' + newName;
    send('file-rename', JSON.stringify({ oldPath, newPath }));
    setTimeout(refresh, 300);
  }, [path, send, refresh]);

  const mkdir = useCallback(() => {
    const name = prompt('目录名:');
    if (!name) return;
    const full = path === '/' ? '/' + name : path + '/' + name;
    send('file-mkdir', full);
    setTimeout(refresh, 300);
  }, [path, send, refresh]);

  const download = useCallback((name: string) => {
    const full = path === '/' ? '/' + name : path + '/' + name;
    send('file-read', full + '|' + 0 + '|' + (1024 * 1024 * 10)); // max 10MB
    pendingRef.current = (msg: any) => {
      if (msg.type === 'file-read-result' && msg.path === full) {
        const blob = new Blob([Uint8Array.from(atob(msg.data), c => c.charCodeAt(0))]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
      }
    };
  }, [path, send]);

  // Upload
  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      const fullPath = path === '/' ? '/' + file.name : path + '/' + file.name;
      send('file-write', JSON.stringify({ path: fullPath, data: base64 }));
      setTimeout(refresh, 500);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [path, send, refresh]);

  const toggle = () => {
    if (!visible) {
      setVisible(true);
      setLoading(true);
      send('file-list', path);
    } else {
      setVisible(false);
    }
  };

  const entryIcon = (e: FileEntry) => {
    if (e.isDir) return <FolderIcon size={16} className="shrink-0" style={{ color: 'var(--accent)' }} />;
    return <FileIcon size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />;
  };

  return (
    <>
      {/* Toggle button */}
      <button onClick={toggle}
        className="p-1.5 rounded-md hover:opacity-80 transition-colors"
        style={{ color: visible ? 'var(--accent)' : 'var(--text-muted)' }}
        title="文件管理">
        <FolderIcon size={14} />
      </button>

      {visible && (
        <div className="border-t shrink-0 flex flex-col" style={{
          height: '300px',
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}>
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-2 py-1 text-xs border-b shrink-0"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <button onClick={goBack} disabled={historyIdx <= 0} className="p-1 hover:opacity-80 disabled:opacity-30">←</button>
            <button onClick={goForward} disabled={historyIdx >= history.length - 1} className="p-1 hover:opacity-80 disabled:opacity-30">→</button>
            <button onClick={goHome} className="p-1 hover:opacity-80"><Home size={12} /></button>
            <button onClick={refresh} className="p-1 hover:opacity-80"><RotateCw size={12} /></button>
            <span className="flex-1 px-2 truncate font-mono text-xs" style={{ color: 'var(--text)' }}>{path}</span>
            <button onClick={mkdir} className="p-1 hover:opacity-80" title="新建目录"><Plus size={12} /></button>
            <label className="p-1 hover:opacity-80 cursor-pointer" title="上传文件">
              <Upload size={12} />
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            </label>
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto text-xs" style={{ color: 'var(--text)' }}>
            {loading ? (
              <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>加载中...</div>
            ) : (
              <div>
                {path !== '/' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:opacity-80"
                    onClick={() => navigate('..')}
                    style={{ borderBottom: '1px solid var(--border)' }}>
                    <ArrowLeft size={14} />
                    <span>..</span>
                  </div>
                )}
                {entries.map(e => (
                  <div key={e.name}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:opacity-80 ${selected === e.name ? 'opacity-80' : ''}`}
                    style={{
                      background: selected === e.name ? 'var(--accent-glow, rgba(74,246,38,0.08))' : 'transparent',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onClick={() => { setSelected(e.name); if (e.isDir) navigate(e.name); }}
                    onContextMenu={(ev: React.MouseEvent) => { ev.preventDefault(); setSelected(e.name); }}>
                    {entryIcon(e)}
                    <span className="flex-1 truncate">{e.name}</span>
                    {!e.isDir && <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{formatSize(e.size)}</span>}
                    {/* Actions */}
                    {selected === e.name && (
                      <span className="flex gap-1 shrink-0">
                        {!e.isDir && <button onClick={() => download(e.name)} className="p-0.5 hover:opacity-80" title="下载"><Download size={12} /></button>}
                        <button onClick={() => renameItem(e.name)} className="p-0.5 hover:opacity-80" title="重命名"><Edit3 size={12} /></button>
                        <button onClick={() => deleteItem(e.name)} className="p-0.5 hover:opacity-80" title="删除" style={{ color: 'var(--error)' }}><Trash2 size={12} /></button>
                      </span>
                    )}
                  </div>
                ))}
                {entries.length === 0 && (
                  <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>空目录</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}