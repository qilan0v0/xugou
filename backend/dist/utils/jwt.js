"use strict";
/**
 * JWT工具类，提供JWT相关的通用功能
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = void 0;
exports.toD1Primitive = toD1Primitive;
exports.generateToken = generateToken;
exports.addDuration = addDuration;
exports.generateAgentName = generateAgentName;
/**
 * 获取JWT密钥
 * 优先从环境变量中获取JWT_SECRET，如果不存在则使用默认值
 *
 * @param c Cloudflare环境上下文
 * @returns JWT密钥
 */
const getJwtSecret = (c) => {
    // 在Cloudflare Workers环境中，使用env变量
    if (typeof process === 'undefined') {
        return c.env.JWT_SECRET || 'your-secret-key-change-in-production';
    }
    // 在Node.js环境中，使用process.env
    return process.env.JWT_SECRET || 'your-secret-key-change-in-production';
};
exports.getJwtSecret = getJwtSecret;
/**
 * 生成随机令牌
 * 生成用于API密钥或认证令牌的随机字符串
 *
 * @returns 生成的随机令牌
 */
/**
 * Ensure a value is safe for D1 binding (primitive only — no objects/arrays).
 */
function toD1Primitive(v) {
    if (v === null || v === undefined)
        return null;
    if (Array.isArray(v))
        return toD1Primitive(v[0]);
    if (typeof v === 'object')
        return String(v);
    return v;
}
async function generateToken() {
    // Generate a random UUID (version 4)
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    // Set UUID v4 markers: version 4 (bits 48-51) and variant (bits 64-65)
    array[6] = (array[6] & 0x0f) | 0x40;
    array[8] = (array[8] & 0x3f) | 0x80;
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function addDuration(date, value, unit) {
    const d = new Date(date);
    switch (unit) {
        case 'day': return new Date(d.getTime() + value * 86400000);
        case 'month':
            d.setMonth(d.getMonth() + value);
            return d;
        case 'year':
            d.setFullYear(d.getFullYear() + value);
            return d;
        default: return d;
    }
}
function generateAgentName(country) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    for (let i = 0; i < 6; i++) {
        rand += chars[array[i] % chars.length];
    }
    return country ? `${country}-${rand}` : rand;
}
