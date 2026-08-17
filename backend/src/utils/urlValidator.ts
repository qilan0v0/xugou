/**
 * URL 安全校验工具
 * 用于防止 SSRF 攻击，拦截内网地址和云厂商元数据地址
 */

// 内网/回环/链路本地地址前缀
const PRIVATE_PATTERNS = [
  '127.', '10.', '0.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '169.254.',
  '::1', 'fe80:', 'fc00:', 'fd00:',
];

// 云厂商元数据地址
const METADATA_HOSTS = [
  '169.254.169.254',
  'metadata.google.internal',
  '100.100.100.200',
  '100.64.0.0',
];

function isPrivateIP(host: string): boolean {
  const lower = host.toLowerCase();
  for (const pattern of METADATA_HOSTS) {
    if (lower === pattern || lower.startsWith(pattern)) return true;
  }
  for (const pattern of PRIVATE_PATTERNS) {
    if (lower.startsWith(pattern)) return true;
  }
  return false;
}

// 允许的 URL 协议
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * 检查 URL 是否安全（非内网、非 metadata、协议允许）
 * @returns 安全返回 null，不安全返回错误描述
 */
export function validateURL(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'URL 格式无效';
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return '不允许的协议，仅支持 http/https';
  }

  if (isPrivateIP(parsed.hostname)) {
    return '不允许访问内网地址或云厂商元数据地址';
  }

  return null;
}