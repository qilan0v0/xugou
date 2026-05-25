import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/index';

// same hash color logic as AgentCard
const TAG_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400',
  'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-400',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-400',
];

function hashColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  poolUrl?: string;             // API endpoint for tag pool
}

export default function TagInput({ value, onChange, placeholder, poolUrl = '/api/agents/tags/pool' }: TagInputProps) {
  const [pool, setPool] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // load tag pool
  useEffect(() => {
    api.get(poolUrl).then(res => {
      if (res.data?.success) setPool(res.data.tags || []);
    }).catch(() => {});
  }, [poolUrl]);

  const candidates = pool
    .filter(t => {
      if (!input.trim()) return true;
      return t.toLowerCase().includes(input.trim().toLowerCase());
    })
    .filter(t => !value.includes(t));

  // if typed text not in pool and not already selected, allow creating it
  const canCreate = input.trim() && !value.includes(input.trim());

  const addTag = useCallback((tag: string) => {
    const t = tag.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setInput('');
    setShowDropdown(false);
    setHighlightIdx(-1);
    inputRef.current?.focus();
  }, [value, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < candidates.length) {
        addTag(candidates[highlightIdx]);
      } else if (canCreate) {
        addTag(input.trim());
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const max = candidates.length + (canCreate ? 1 : 0);
      setHighlightIdx(prev => (prev + 1) % Math.max(1, max));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const max = candidates.length + (canCreate ? 1 : 0);
      setHighlightIdx(prev => (prev - 1 + max) % Math.max(1, max));
      return;
    }
    if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightIdx(-1);
      return;
    }
  };

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setHighlightIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasDropdown = candidates.length > 0 || canCreate;

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition-all cursor-text min-h-[42px]"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => (
          <span key={tag} className={`text-xs pl-2 pr-1 py-0.5 rounded-full font-medium select-none inline-flex items-center gap-0.5 ${hashColor(tag)}`}>
            {tag}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(value.filter(t => t !== tag)); }}
              className="w-4 h-4 rounded-full inline-flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors leading-none"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setShowDropdown(true); setHighlightIdx(-1); }}
          onFocus={() => { if (hasDropdown) setShowDropdown(true); }}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? (placeholder || '输入标签，回车添加') : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none placeholder:text-slate-400"
        />
      </div>

      {/* dropdown */}
      {showDropdown && hasDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl max-h-48 overflow-y-auto">
          {candidates.map((tag, i) => (
            <button
              key={tag}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                i === highlightIdx
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white dark:bg-slate-900'
              }`}
              onMouseDown={e => { e.preventDefault(); addTag(tag); }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${hashColor(tag)}`}>{tag}</span>
              <span className="text-[11px] text-slate-400 ml-auto">选择</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 border-t border-white/[0.06] ${
                highlightIdx === candidates.length
                  ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white dark:bg-slate-900'
              }`}
              onMouseDown={e => { e.preventDefault(); addTag(input.trim()); }}
              onMouseEnter={() => setHighlightIdx(candidates.length)}
            >
              <span className="font-medium">创建</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                {input.trim()}
              </span>
              <span className="text-[11px] text-slate-400 ml-auto">新建</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
