import api from './index';
import { Monitor } from './monitors';
import { Agent } from './agents';

// 后端返回的监控项结构
export interface ConfigMonitor {
  id: number;
  name: string;
  selected: boolean;
}

// 后端返回的客户端结构
export interface ConfigAgent {
  id: number;
  name: string;
  selected: boolean;
}

// 状态页配置接口（从后端获取时使用）
export interface StatusPageConfigResponse {
  title: string;
  description: string;
  logoUrl: string;
  customCss: string;
  urlPrefix?: string; // 状态页URL前缀
  monitors: ConfigMonitor[]; // 监控项对象数组
  agents: ConfigAgent[]; // 客户端对象数组
}

// 状态页配置接口（保存到后端时使用）
export interface StatusPageConfig {
  title: string;
  description: string;
  logoUrl: string;
  customCss: string;
  urlPrefix?: string; // 状态页URL前缀
  monitors: number[]; // 选中的监控ID列表
  agents: number[]; // 选中的客户端ID列表
}

// 状态页中展示的客户端类型，包含资源使用信息
export interface StatusAgent extends Agent {
  cpu?: number;
  memory?: number;
  disk?: number;
}

// 状态页数据接口
export interface StatusPageData {
  title: string;
  description: string;
  logoUrl: string;
  customCss: string;
  urlPrefix?: string; // 状态页URL前缀
  monitors: Monitor[];
  agents: StatusAgent[];
}

// 获取状态页配置
export const getStatusPageConfig = async (): Promise<{
  success: boolean;
  message?: string;
  config?: StatusPageConfigResponse;
}> => {
  try {
    const response = await api.get<{
      success: boolean;
      message?: string;
      config?: StatusPageConfigResponse;
    }>('/api/status/config');
    return response.data;
  } catch (error) {
    console.error('获取状态页配置失败:', error);
    return {
      success: false,
      message: '获取状态页配置失败'
    };
  }
};

// 保存状态页配置
export const saveStatusPageConfig = async (config: StatusPageConfig): Promise<{
  success: boolean;
  message?: string;
}> => {
  try {
    const response = await api.post<{
      success: boolean;
      message?: string;
    }>('/api/status/config', config);

    return response.data;
  } catch (error) {
    console.error('保存状态页配置失败:', error);

    return {
      success: false,
      message: '保存状态页配置失败'
    };
  }
};

// 请求去重：同一时刻只允许一个 /api/status/data 请求
let _pending: Promise<any> | null = null;

// 获取状态页数据（带去重 + 自动重试）
export const getStatusPageData = async (retries = 2): Promise<{
  success: boolean;
  message?: string;
  data?: StatusPageData;
}> => {
  // Dedup: reuse in-flight request
  if (_pending) {
    try { return await _pending; } catch { _pending = null; }
  }

  const doFetch = async () => {
    try {
      const response = await api.get('/api/status/data');
      const { success, data, message } = response.data;
      if (success && data) {
        return {
          success: true,
          data: {
            ...data,
            monitors: data.monitors || [],
            agents: data.agents || [],
          } as StatusPageData,
        };
      }
      return { success: false, message: message || '获取状态页数据失败' };
    } catch {
      return { success: false, message: '获取状态页数据失败' };
    }
  };

  for (let i = 0; i <= retries; i++) {
    _pending = doFetch();
    const result = await _pending;
    _pending = null;
    if (result.success || i === retries) return result;
    // Wait before retry (1s, 2s, ...)
    if (i < retries) await new Promise(r => setTimeout(r, (i + 1) * 1000));
  }

  _pending = null;
  return { success: false, message: '获取状态页数据失败' };
}; 