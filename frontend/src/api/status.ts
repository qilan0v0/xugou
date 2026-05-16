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
    console.log('API请求 - 保存状态页配置：', config);
    
    const response = await api.post<{
      success: boolean;
      message?: string;
    }>('/api/status/config', config);
    
    console.log('API响应 - 保存状态页配置：', response);
    
    return response.data;
  } catch (error) {
    console.error('保存状态页配置失败:', error);
    console.log('API错误详情:', {
      error,
      config
    });
    
    return {
      success: false,
      message: '保存状态页配置失败'
    };
  }
};

// 获取状态页数据
export const getStatusPageData = async (): Promise<{
  success: boolean;
  message?: string;
  data?: StatusPageData;
}> => {
  try {
    console.log('开始请求状态页数据...');
    const response = await api.get('/api/status/data');
    console.log('状态页数据响应:', response.data);
    
    // 后端返回 { success: true, data: {...} } 格式
    const { success, data, message } = response.data;
    
    if (success && data) {
      console.log('返回成功的状态数据:', data);
      
      // 确保监控和客户端数据存在
      const processedData = {
        ...data,
        monitors: data.monitors || [],
        agents: data.agents || []
      };
      
      return {
        success: true,
        data: processedData as StatusPageData
      };
    } else {
      console.error('获取状态页数据失败:', message);
      return {
        success: false,
        message: message || '获取状态页数据失败'
      };
    }
  } catch (error) {
    console.error('获取状态页数据失败:', error);
    return {
      success: false,
      message: '获取状态页数据失败'
    };
  }
}; 