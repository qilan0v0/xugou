// 状态页数据查询工具函数 — 供 SSE 推送和 HTTP API 共享

import { Bindings } from '../models/db';

const agentFields = ['id','name','status','created_at','updated_at',
  'cpu_usage','memory_total','memory_used','disk_total','disk_used',
  'network_rx','network_tx','network_rx_total','network_tx_total',
  'hostname','os','version','cpu_arch','cpu_model_name',
  'cpu_cores','load1','load5','load15','boot_time','agent_version',
  'country','connected_at','traffic_limit','expiry_time','start_time',
  'duration_value','duration_unit','category','tags','public',
  'process_count','tcp_count','udp_count'];

export interface EnrichedAgent {
  [key: string]: any;
  id: number;
  name: string;
  status: string;
  cpu: number;
  memory: number;
  disk: number;
}

export interface EnrichedMonitor {
  [key: string]: any;
  id: number;
  name: string;
  status: string;
  history: string[];
}

/** 查询并富化 agent 列表 */
export async function fetchAgents(env: any, isAuthenticated: boolean): Promise<EnrichedAgent[]> {
  const query = isAuthenticated
    ? "SELECT * FROM agents ORDER BY sort_order ASC, created_at DESC"
    : "SELECT * FROM agents WHERE public = 1 ORDER BY sort_order ASC, created_at DESC";
  const rows = await env.DB.prepare(query).all();
  return (rows.results || []).map((agent: any) => {
    const picked: any = {};
    for (const k of agentFields) picked[k] = agent[k];
    const memoryPercent = picked.memory_total && picked.memory_used
      ? (picked.memory_used / picked.memory_total) * 100 : null;
    const diskPercent = picked.disk_total && picked.disk_used
      ? (picked.disk_used / picked.disk_total) * 100 : null;
    return {
      ...picked,
      cpu: picked.cpu_usage || 0,
      memory: memoryPercent || 0,
      disk: diskPercent || 0,
    };
  });
}

/** 查询并富化 monitor 列表（含 24 条状态历史） */
export async function fetchMonitors(env: any, isAuthenticated: boolean): Promise<EnrichedMonitor[]> {
  const query = isAuthenticated
    ? "SELECT * FROM monitors WHERE active = 1 ORDER BY sort_order ASC, created_at DESC"
    : "SELECT * FROM monitors WHERE active = 1 AND public = 1 ORDER BY sort_order ASC, created_at DESC";
  const rows = await env.DB.prepare(query).all();
  const monitorList = (rows.results || []);

  // 批量加载历史状态
  const historyMap = new Map<number, string[]>();
  if (monitorList.length > 0) {
    try {
      const ids = monitorList.map((m: any) => m.id);
      const placeholders = ids.map(() => '?').join(',');
      const allHistory = await env.DB.prepare(
        `SELECT monitor_id, status FROM monitor_status_history
         WHERE monitor_id IN (${placeholders})
         ORDER BY monitor_id, timestamp DESC`
      ).bind(...ids).all();
      for (const row of (allHistory.results || [])) {
        if (!historyMap.has(row.monitor_id)) historyMap.set(row.monitor_id, []);
        const arr = historyMap.get(row.monitor_id)!;
        if (arr.length < 24) arr.push(row.status);
      }
    } catch { /* fallback */ }
  }

  return monitorList.map((monitor: any) => {
    const { url, ...rest } = monitor;
    const hist = historyMap.get(monitor.id) || [];
    return { ...rest, history: hist.reverse() };
  });
}

/** 查询状态页配置（title / description / logoUrl / customCss） */
export async function fetchPageConfig(env: any): Promise<{ title: string; description: string; logoUrl: string; customCss: string }> {
  const defaults = { title: '系统状态', description: '实时监控系统运行状态', logoUrl: '', customCss: '' };
  try {
    const config = await env.DB.prepare('SELECT * FROM status_page_config LIMIT 1').first();
    if (config) {
      return {
        title: config.title || defaults.title,
        description: config.description || defaults.description,
        logoUrl: config.logo_url || '',
        customCss: config.custom_css || '',
      };
    }
  } catch { /* */ }
  return defaults;
}
