// 应用配置

// Auth/设置后端 (CF Workers: 用户、密码、设置 — 低频)
export const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_API_BASE_URL || '';

// 数据后端 (Node.js/CF Workers: agent、monitor — 高频)
export const DATA_API_URL = import.meta.env.VITE_DATA_API_URL || import.meta.env.VITE_API_BASE_URL || '';

export const ENV_API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 10000;
