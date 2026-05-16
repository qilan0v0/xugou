// 客户端类型定义
export interface Agent {
  id: number;
  name: string;
  token: string;
  created_by: number;
  status: string;
  created_at: string;
  updated_at: string;
  hostname?: string;
  ip_address?: string;
  os?: string;
  version?: string;
  
  // 资源指标字段
  cpu_usage?: number;
  memory_total?: number;
  memory_used?: number;
  disk_total?: number;
  disk_used?: number;
  network_rx?: number;
  network_tx?: number;

  // 系统详细信息
  cpu_arch?: string;
  cpu_model_name?: string;
  cpu_cores?: number;
  load1?: number;
  load5?: number;
  load15?: number;
  boot_time?: string;
  network_rx_total?: number;
  network_tx_total?: number;
  agent_version?: string;
  country?: string;
} 