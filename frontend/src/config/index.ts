const buildTimeUrl = import.meta.env.VITE_API_BASE_URL;
const customUrl = typeof window !== 'undefined' ? localStorage.getItem('custom_api_base_url') : null;
export const ENV_API_BASE_URL = customUrl || buildTimeUrl || '';
export const ENV_API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 10000;
