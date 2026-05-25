import { useState } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';

export const specificStatusCodes = [
  { group: '2xx - 成功', codes: [
    { label: '2xx - 所有成功状态码', value: 2, isRange: true },
    { label: '200 - OK', value: 200 },
    { label: '201 - Created', value: 201 },
    { label: '204 - No Content', value: 204 }
  ]},
  { group: '3xx - 重定向', codes: [
    { label: '3xx - 所有重定向状态码', value: 3, isRange: true },
    { label: '301 - Moved Permanently', value: 301 },
    { label: '302 - Found', value: 302 },
    { label: '304 - Not Modified', value: 304 }
  ]},
  { group: '4xx - 客户端错误', codes: [
    { label: '4xx - 所有客户端错误状态码', value: 4, isRange: true },
    { label: '400 - Bad Request', value: 400 },
    { label: '401 - Unauthorized', value: 401 },
    { label: '403 - Forbidden', value: 403 },
    { label: '404 - Not Found', value: 404 }
  ]},
  { group: '5xx - 服务器错误', codes: [
    { label: '5xx - 所有服务器错误状态码', value: 5, isRange: true },
    { label: '500 - Internal Server Error', value: 500 },
    { label: '502 - Bad Gateway', value: 502 },
    { label: '503 - Service Unavailable', value: 503 },
    { label: '504 - Gateway Timeout', value: 504 }
  ]}
];

interface StatusCodeSelectProps {
  value: number | string;
  onChange: (value: number) => void;
  name?: string;
  required?: boolean;
}

const StatusCodeSelect = ({ value, onChange, name = "expectedStatus", required = false }: StatusCodeSelectProps) => {
  const [open, setOpen] = useState(false);
  const selected = specificStatusCodes.flatMap(g => g.codes).find(c => c.value === Number(value));

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-left text-slate-700 dark:text-slate-300 hover:border-blue-500/50 transition-colors flex items-center justify-between">
        <span>{selected?.label || '选择状态码'}</span>
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full z-20 glass py-1 max-h-80 overflow-y-auto animate-fade-in">
            {specificStatusCodes.map((group, gi) => (
              <div key={gi}>
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase">{group.group}</div>
                {group.codes.map(code => (
                  <button key={code.value} type="button"
                    onClick={() => { onChange(code.value); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-white dark:bg-slate-900 transition-colors flex items-center justify-between ${
                      Number(value) === code.value ? 'text-blue-500 font-medium' : 'text-slate-700 dark:text-slate-300'
                    }`}
                    style={{ paddingLeft: code.isRange ? '24px' : '32px' }}>
                    {code.label}
                    {Number(value) === code.value && <CheckIcon className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default StatusCodeSelect;
