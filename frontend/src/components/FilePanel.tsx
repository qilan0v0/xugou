import { useRef } from 'react';
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
  visible: boolean;
  path: string;
  entries: FileEntry[];
  loading: boolean;
  selected: string | null;
  history: string[];
  historyIdx: number;
  onToggle: () => void;
  onNavigate: (dir: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoHome: () => void;
  onRefresh: () => void;
  onDelete: (name: string) => void;
  onRename: (name: string) => void;
  onMkdir: () => void;
  onDownload: (name: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (name: string | null) => void;
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

const entryIcon = (e: FileEntry) => e.isDir
  ? <FolderIcon size={16} className="shrink-0" style={{ color: 'var(--accent)' }} />
  : <FileIcon size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />;

export function FilePanelButton({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className="p-1.5 rounded-md hover:opacity-80 transition-colors shrink-0"
      style={{ color: visible ? 'var(--accent)' : 'var(--text-muted)' }}
      title="文件管理">
      <FolderIcon size={14} />
    </button>
  );
}

export function FilePanelContent({
  visible, path, entries, loading, selected, historyIdx, history,
  onNavigate, onGoBack, onGoForward, onGoHome, onRefresh,
  onDelete, onRename, onMkdir, onDownload, onUpload, onSelect,
}: FilePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!visible) return null;

  return (
    <div className="flex flex-col border-l shrink-0 max-lg:absolute max-lg:right-0 max-lg:top-0 max-lg:bottom-0 max-lg:z-50" style={{
      width: '320px',
      background: 'var(--bg-surface)',
      borderColor: 'var(--border)',
    }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 text-xs border-b shrink-0" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        <button onClick={onGoBack} disabled={historyIdx <= 0} className="p-1 hover:opacity-80 disabled:opacity-30">←</button>
        <button onClick={onGoForward} disabled={historyIdx >= history.length - 1} className="p-1 hover:opacity-80 disabled:opacity-30">→</button>
        <button onClick={onGoHome} className="p-1 hover:opacity-80"><Home size={12} /></button>
        <button onClick={onRefresh} className="p-1 hover:opacity-80"><RotateCw size={12} /></button>
        <span className="flex-1 px-2 truncate font-mono text-xs" style={{ color: 'var(--text)' }}>{path}</span>
        <button onClick={onMkdir} className="p-1 hover:opacity-80" title="新建目录"><Plus size={12} /></button>
        <label className="p-1 hover:opacity-80 cursor-pointer" title="上传文件">
          <Upload size={12} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={onUpload} />
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
                onClick={() => onNavigate('..')}
                style={{ borderBottom: '1px solid var(--border)' }}>
                <ArrowLeft size={14} /><span>..</span>
              </div>
            )}
            {entries.map(e => (
              <div key={e.name} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:opacity-80 ${selected === e.name ? 'opacity-80' : ''}`}
                style={{
                  background: selected === e.name ? 'var(--accent-glow, rgba(74,246,38,0.08))' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                }}
                onClick={() => { onSelect(e.name); if (e.isDir) onNavigate(e.name); }}>
                {entryIcon(e)}
                <span className="flex-1 truncate">{e.name}</span>
                {!e.isDir && <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>{formatSize(e.size)}</span>}
                {selected === e.name && (
                  <span className="flex gap-1 shrink-0">
                    {!e.isDir && <button onClick={() => onDownload(e.name)} className="p-0.5 hover:opacity-80"><Download size={12} /></button>}
                    <button onClick={() => onRename(e.name)} className="p-0.5 hover:opacity-80"><Edit3 size={12} /></button>
                    <button onClick={() => onDelete(e.name)} className="p-0.5 hover:opacity-80" style={{ color: 'var(--error)' }}><Trash2 size={12} /></button>
                  </span>
                )}
              </div>
            ))}
            {entries.length === 0 && !loading && <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>空目录</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export for backward compat
export type { FileEntry };
export { formatSize };