import axios from 'axios';
import { ENV_API_BASE_URL, ENV_API_TIMEOUT } from '../config';

const api = axios.create({
  baseURL: ENV_API_BASE_URL,
  timeout: ENV_API_TIMEOUT,
  // Content-Type is auto-set by axios per-request (only for POST/PUT with body), avoids CORS preflight on GET
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

export default api;
