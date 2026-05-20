import { useState, useEffect, useRef } from 'react';
import api from '../api/index';

interface GroupSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function GroupSelect({ value, onChange, placeholder, className }: GroupSelectProps) {
  const [groups, setGroups] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/api/agents/groups/pool').then(res => {
      if (res.data?.success) setGroups(res.data.groups || []);
    }).catch(() => {});
  }, []);

  const filtered = groups.filter(g =>
    !value || g.toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (highlight >= 0 && highlight < filtered.length) select(filtered[highlight]); return; }
    if (e.key === 'Escape') { setOpen(false); setHighlight(-1); return; }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || '选择或输入分组'}
        className={className}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-white/[0.08] bg-white dark:bg-slate-800 shadow-xl max-h-40 overflow-y-auto">
          {value && !groups.includes(value) && (
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-b border-white/[0.06] ${
                highlight === -1 ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
              }`}
              onMouseDown={e => { e.preventDefault(); onChange(value); setOpen(false); }}
            >
              <span className="text-[10px] text-slate-400">使用</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400">{value}</span>
              <span className="text-[10px] text-slate-400 ml-auto">自定义</span>
            </button>
          )}
          {filtered.map((g, i) => (
            <button
              key={g}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                i === highlight ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              } ${g === value ? 'font-medium' : ''}`}
              onMouseDown={e => { e.preventDefault(); select(g); }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${g === value ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'}`}>
                {g}
              </span>
              {g === value && <span className="text-[10px] text-blue-500 ml-auto">已选</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
