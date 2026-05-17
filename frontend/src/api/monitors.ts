import api from './index';

export interface Monitor {
  id: number;
  name: string;
  url: string;
  method: string;
  interval: number;
  timeout: number;
  expected_status: number;
  headers: string;
  body: string;
  created_by: number;
  active: boolean;
  status: string; // up, down, degraded, pending
  uptime: number;
  response_time: number;
  last_checked: string;
  created_at: string;
  updated_at: string;
  history?: MonitorStatusHistory[];
  checks?: MonitorCheck[];
}

export interface MonitorStatusHistory {
  id: number;
  monitor_id: number;
  status: string;
  timestamp: string;
}

export interface MonitorCheck {
  id: number;
  monitor_id: number;
  status: string;
  response_time: number;
  status_code: number;
  error: string | null;
  checked_at: string;
}

export interface MonitorResponse {
  success: boolean;
  message?: string;
  monitor?: Monitor;
  monitors?: Monitor[];
}

export interface HistoryResponse {
  success: boolean;
  message?: string;
  history: MonitorStatusHistory[];
}

export interface ChecksResponse {
  success: boolean;
  message?: string;
  checks: MonitorCheck[];
}

export interface CreateMonitorRequest {
  name: string;
  url: string;
  method: string;
  interval?: number;
  timeout?: number;
  expectedStatus?: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface UpdateMonitorRequest {
  name?: string;
  url?: string;
  method?: string;
  interval?: number;
  timeout?: number;
  expectedStatus?: number;
  headers?: Record<string, string>;
  body?: string;
  active?: boolean;
  status?: string;
  uptime?: number;
  responseTime?: number;
  lastChecked?: string;
}

// 获取所有监控
export const getAllMonitors = async (): Promise<MonitorResponse> => {
  const response = await api.get<MonitorResponse>('/api/monitors');
  return response.data;
};

// 获取单个监控
export const getMonitor = async (id: number): Promise<MonitorResponse> => {
  const response = await api.get<MonitorResponse>(`/api/monitors/${id}`);
  return response.data;
};

// 创建监控
export const createMonitor = async (data: CreateMonitorRequest): Promise<MonitorResponse> => {
  const response = await api.post<MonitorResponse>('/api/monitors', data);
  return response.data;
};

// 更新监控
export const updateMonitor = async (id: number, data: UpdateMonitorRequest): Promise<MonitorResponse> => {
  const response = await api.put<MonitorResponse>(`/api/monitors/${id}`, data);
  return response.data;
};

// 删除监控
export const deleteMonitor = async (id: number): Promise<MonitorResponse> => {
  const response = await api.delete<MonitorResponse>(`/api/monitors/${id}`);
  return response.data;
};

// 获取监控历史
export const getMonitorHistory = async (id: number): Promise<HistoryResponse> => {
  const response = await api.get<HistoryResponse>(`/api/monitors/${id}/history`);
  return response.data;
};

// 获取监控检查记录
export const getMonitorChecks = async (id: number, limit: number = 10): Promise<ChecksResponse> => {
  const response = await api.get<ChecksResponse>(`/api/monitors/${id}/checks?limit=${limit}`);
  return response.data;
};

// 手动检查监控
export interface CheckResponse {
  success: boolean;
  message?: string;
  result?: any;
}

export const checkMonitor = async (id: number): Promise<CheckResponse> => {
  const response = await api.post<CheckResponse>(`/api/monitors/${id}/check`);
  return response.data;
}; 