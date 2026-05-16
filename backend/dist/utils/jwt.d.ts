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
export declare const getJwtSecret: (c: any) => string;
/**
 * 生成随机令牌
 * 生成用于API密钥或认证令牌的随机字符串
 *
 * @returns 生成的随机令牌
 */
/**
 * Ensure a value is safe for D1 binding (primitive only — no objects/arrays).
 */
export declare function toD1Primitive(v: any): string | number | null;
export declare function generateToken(): Promise<string>;
