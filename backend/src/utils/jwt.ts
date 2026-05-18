/**
 * JWT工具类，提供JWT相关的通用功能
 */

/**
 * 获取JWT密钥
 * 优先从环境变量中获取JWT_SECRET，如果不存在则使用默认值
 * 
 * @param c Cloudflare环境上下文
 * @returns JWT密钥
 */
export const getJwtSecret = (c: any): string => {
  // 在Cloudflare Workers环境中，使用env变量
  if (typeof process === 'undefined') {
    return c.env.JWT_SECRET || 'your-secret-key-change-in-production';
  }
  // 在Node.js环境中，使用process.env
  return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
};

/**
 * 生成随机令牌
 * 生成用于API密钥或认证令牌的随机字符串
 * 
 * @returns 生成的随机令牌
 */
/**
 * Ensure a value is safe for D1 binding (primitive only — no objects/arrays).
 */
export function toD1Primitive(v: any): string | number | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return toD1Primitive(v[0]);
  if (typeof v === 'object') return String(v);
  return v;
}

export async function generateToken(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function generateAgentName(country?: string | null): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rand = '';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  for (let i = 0; i < 6; i++) {
    rand += chars[array[i] % chars.length];
  }
  return country ? `${country}-${rand}` : rand;
} 