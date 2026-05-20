import { useState, useEffect, useId } from 'react';
import api from '../api/index';

interface GroupSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function GroupSelect({ value, onChange, placeholder, className }: GroupSelectProps) {
  const [groups, setGroups] = useState<string[]>([]);
  const id = useId();

  useEffect(() => {
    api.get('/api/agents/groups/pool').then(res => {
      if (res.data?.success) setGroups(res.data.groups || []);
    }).catch(() => {});
  }, []);

  return (
    <>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        list={id}
        placeholder={placeholder || '选择或输入分组'}
        className={className}
      />
      <datalist id={id}>
        {groups.map(g => <option key={g} value={g} />)}
      </datalist>
    </>
  );
}
