const buildTimeUrl = import.meta.env.VITE_API_BASE_URL;
let customUrl: string | null = null;
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('custom_api_base_url');
  if (stored) {
    // 自动迁移：如果构建时 URL 为空（同源反代模式），且 localStorage 存的是
    // 跨域地址（旧版直连后端地址），则自动清除，避免绕过反代暴露后端。
    // 同源地址（如 /api、https://同域名）保留，用于运行时动态切换。
    if (!buildTimeUrl) {
      try {
        const storedOrigin = new URL(stored).origin;
        if (storedOrigin !== window.location.origin) {
          localStorage.removeItem('custom_api_base_url');
        } else {
          customUrl = stored;
        }
      } catch {
        localStorage.removeItem('custom_api_base_url');
      }
    } else {
      customUrl = stored;
    }
  }
}
export const ENV_API_BASE_URL = customUrl || buildTimeUrl || '';
export const ENV_API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 10000;
