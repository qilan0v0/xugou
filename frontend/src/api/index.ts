import axios from 'axios';
import { AUTH_API_URL, DATA_API_URL, ENV_API_TIMEOUT } from '../config';

function createApi(baseURL: string) {
  const api = axios.create({
    baseURL,
    timeout: ENV_API_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: false,
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return api;
}

// Auth 后端 (CF Workers: 登录、注册、用户、设置)
export const authApi = createApi(AUTH_API_URL);

// Data 后端 (Node.js / CF Workers: agent、monitor、状态页数据)
export const dataApi = createApi(DATA_API_URL);

// 默认导出 — 向后兼容 (指向 data 后端)
export default dataApi;
