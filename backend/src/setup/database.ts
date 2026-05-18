// 初始化数据库脚本
// 用于在 Cloudflare Workers 环境中创建数据库表和初始数据

import { Hono } from 'hono';
import crypto from 'crypto';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verify;
}
import { Bindings } from '../models/db';

const initDb = new Hono<{ Bindings: Bindings }>();

// 创建数据库表结构
export async function createTables(env: Bindings): Promise<void> {
  console.log('创建用户表...');
  await env.DB.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password TEXT NOT NULL, email TEXT, role TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");

  console.log('创建监控表...');
  await env.DB.exec("CREATE TABLE IF NOT EXISTS monitors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL, method TEXT NOT NULL, interval INTEGER NOT NULL, timeout INTEGER NOT NULL, expected_status INTEGER NOT NULL, headers TEXT NOT NULL, body TEXT, created_by INTEGER NOT NULL, active BOOLEAN NOT NULL, status TEXT DEFAULT 'pending', public INTEGER DEFAULT 1, uptime REAL DEFAULT 100.0, response_time INTEGER DEFAULT 0, last_checked TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (created_by) REFERENCES users(id))");

  console.log('创建监控历史记录表...');
  await env.DB.exec("CREATE TABLE IF NOT EXISTS monitor_checks (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id INTEGER NOT NULL, status TEXT NOT NULL, response_time INTEGER, status_code INTEGER, error TEXT, checked_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (monitor_id) REFERENCES monitors(id))");

  console.log('创建监控状态历史表...');
  await env.DB.exec("CREATE TABLE IF NOT EXISTS monitor_status_history (id INTEGER PRIMARY KEY AUTOINCREMENT, monitor_id INTEGER NOT NULL, status TEXT NOT NULL, timestamp TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (monitor_id) REFERENCES monitors(id))");

  console.log('创建客户端表...');
  await env.DB.exec("CREATE TABLE IF NOT EXISTS agents (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, token TEXT NOT NULL UNIQUE, created_by INTEGER NOT NULL, status TEXT DEFAULT 'inactive', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, hostname TEXT, ip_address TEXT, os TEXT, version TEXT, cpu_usage REAL, memory_total INTEGER, memory_used INTEGER, disk_total INTEGER, disk_used INTEGER, network_rx INTEGER, network_tx INTEGER, cpu_arch TEXT, cpu_model_name TEXT, cpu_cores INTEGER, load1 REAL, load5 REAL, load15 REAL, boot_time TEXT, network_rx_total INTEGER, network_tx_total INTEGER, agent_version TEXT, country TEXT, connected_at TEXT, last_payload TEXT, traffic_limit INTEGER, expiry_time TEXT, category TEXT, tags TEXT, public INTEGER DEFAULT 1, FOREIGN KEY (created_by) REFERENCES users(id))");

  console.log('创建状态页配置表...');
  await env.DB.exec("CREATE TABLE IF NOT EXISTS status_page_config (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL DEFAULT '系统状态', description TEXT DEFAULT '系统当前运行状态', logo_url TEXT DEFAULT '', custom_css TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))");

  console.log('创建状态页监控项关联表...');
  await env.DB.exec("CREATE TABLE IF NOT EXISTS status_page_monitors (config_id INTEGER NOT NULL, monitor_id INTEGER NOT NULL, PRIMARY KEY (config_id, monitor_id), FOREIGN KEY (config_id) REFERENCES status_page_config(id) ON DELETE CASCADE, FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE)");

  console.log('创建状态页客户端关联表...');
  await env.DB.exec("CREATE TABLE IF NOT EXISTS status_page_agents (config_id INTEGER NOT NULL, agent_id INTEGER NOT NULL, PRIMARY KEY (config_id, agent_id), FOREIGN KEY (config_id) REFERENCES status_page_config(id) ON DELETE CASCADE, FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE)");
}

// 创建管理员用户
export async function createAdminUser(env: Bindings): Promise<void> {
  console.log('检查管理员用户...');
  const adminUser = await env.DB.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind('admin').first();

  // 如果不存在管理员用户，则创建一个
  if (!adminUser) {
    console.log('创建管理员用户...');
    const hashedPassword = hashPassword('admin123');
    const now = new Date().toISOString();

    env.DB.prepare(
      `INSERT INTO users (username, password, email, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      'admin',
      hashedPassword,
      'admin@mdzz.uk',
      'admin',
      now,
      now
    ).run();
  }
}

// 添加示例监控数据
export async function addSampleMonitors(env: Bindings): Promise<void> {
  // 检查是否已有示例监控数据
  const existingMonitors = await env.DB.prepare('SELECT COUNT(*) as count FROM monitors').first<{count: number}>();
  
  if (!existingMonitors || existingMonitors.count === 0) {
    console.log('添加示例监控...');
    const now = new Date().toISOString();
    const userId = 1; // 管理员用户ID
    
    await env.DB.prepare(
      `INSERT INTO monitors (name, url, method, interval, timeout, expected_status, headers, body, created_by, active, status, uptime, response_time, last_checked, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      '百度',
      'https://www.baidu.com',
      'GET',
      60,
      30,
      200,
      '{}',
      '',
      userId,
      true,
      'up',
      99.98,
      120,
      now,
      now,
      now
    ).run();
    
    await env.DB.prepare(
      `INSERT INTO monitors (name, url, method, interval, timeout, expected_status, headers, body, created_by, active, status, uptime, response_time, last_checked, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      '哔哩哔哩',
      'https://www.bilibili.com',
      'GET',
      30,
      30,
      200,
      '{}',
      '',
      userId,
      true,
      'up',
      99.95,
      150,
      now,
      now,
      now
    ).run();
    
    await env.DB.prepare(
      `INSERT INTO monitors (name, url, method, interval, timeout, expected_status, headers, body, created_by, active, status, uptime, response_time, last_checked, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      '油管',
      'https://www.youtube.com',
      'GET',
      60,
      30,
      200,
      '{}',
      '',
      userId,
      true,
      'up',
      99.9,
      180,
      now,
      now,
      now
    ).run();
  }
}

// 添加示例客户端数据
export async function addSampleAgents(env: Bindings): Promise<void> {
  // 检查是否已有示例客户端数据
  const existingAgents = await env.DB.prepare('SELECT COUNT(*) as count FROM agents').first<{count: number}>();
  
  if (!existingAgents || existingAgents.count === 0) {
    console.log('添加示例客户端...');
    const now = new Date().toISOString();
    const userId = 1; // 管理员用户ID
    
    // 主服务器
    await env.DB.prepare(
      `INSERT INTO agents (name, token, created_by, status, created_at, updated_at, cpu_usage, memory_total, memory_used, disk_total, disk_used, network_rx, network_tx, hostname, ip_address, os, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      '主服务器',
      'primary-server-token-123456',
      userId,
      'active',
      now,
      now,
      25.5,  // CPU使用率
      16384, // 内存总量 (MB)
      8192,  // 内存使用量 (MB)
      500000, // 磁盘总量 (MB)
      250000, // 磁盘使用量 (MB)
      1024,   // 网络接收流量 (KB)
      512,    // 网络发送流量 (KB)
      'primary-server', // 主机名
      '192.168.1.10',   // IP地址
      'Linux Ubuntu 20.04', // 操作系统
      '1.0.0'           // 版本
    ).run();
    
    // 备份服务器
    await env.DB.prepare(
      `INSERT INTO agents (name, token, created_by, status, created_at, updated_at, cpu_usage, memory_total, memory_used, disk_total, disk_used, network_rx, network_tx, hostname, ip_address, os, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      '备份服务器',
      'backup-server-token-789012',
      userId,
      'active',
      now,
      now,
      15.0,  // CPU使用率
      8192,  // 内存总量 (MB)
      4096,  // 内存使用量 (MB)
      1000000, // 磁盘总量 (MB)
      300000,  // 磁盘使用量 (MB)
      512,     // 网络接收流量 (KB)
      256,     // 网络发送流量 (KB)
      'backup-server', // 主机名
      '192.168.1.20',  // IP地址
      'Linux Debian 11', // 操作系统
      '1.0.0'           // 版本
    ).run();
    
    // 应用服务器
    await env.DB.prepare(
      `INSERT INTO agents (name, token, created_by, status, created_at, updated_at, cpu_usage, memory_total, memory_used, disk_total, disk_used, network_rx, network_tx, hostname, ip_address, os, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      '应用服务器',
      'app-server-token-345678',
      userId,
      'active',
      now,
      now,
      45.0,  // CPU使用率
      32768, // 内存总量 (MB)
      24576, // 内存使用量 (MB)
      250000, // 磁盘总量 (MB)
      150000, // 磁盘使用量 (MB)
      2048,   // 网络接收流量 (KB)
      1024,   // 网络发送流量 (KB)
      'app-server',    // 主机名
      '192.168.1.30',  // IP地址
      'Linux CentOS 7', // 操作系统
      '1.0.0'           // 版本
    ).run();
  }
}

// 初始化数据库，包括创建表和填充示例数据
export async function initializeDatabase(env: Bindings): Promise<{ success: boolean, message: string }> {
  try {
    console.log('开始初始化数据库...');
    
    // 创建表结构
    await createTables(env);
    
    // 创建管理员用户
    await createAdminUser(env);
    
    // 添加示例数据
    await addSampleMonitors(env);
    await addSampleAgents(env);
    
    // 创建默认状态页配置和关联数据
    await createDefaultStatusPage(env);
    
    return {
      success: true,
      message: '数据库初始化成功',
    };
  } catch (error) {
    console.error('数据库初始化错误:', error);
    return {
      success: false,
      message: `数据库初始化失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// 创建默认状态页配置
export async function createDefaultStatusPage(env: Bindings): Promise<void> {
  // 检查是否已有状态页配置
  const existingConfig = await env.DB.prepare('SELECT COUNT(*) as count FROM status_page_config').first<{count: number}>();
  
  if (existingConfig && existingConfig.count === 0) {
    console.log('创建默认状态页配置...');
    const now = new Date().toISOString();
    const userId = 1; // 管理员用户ID
    
    // 创建配置
    const result = await env.DB.prepare(
      `INSERT INTO status_page_config (user_id, title, description, logo_url, custom_css, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId,
      '系统状态',
      '实时监控系统运行状态',
      '',
      '',
      now,
      now
    ).run();
    
    // 获取配置ID
    const configId = await env.DB.prepare('SELECT last_insert_rowid() as id').first<{id: number}>();
    
    if (configId && configId.id) {
      // 关联所有监控项
      const monitors = await env.DB.prepare('SELECT id FROM monitors').all<{id: number}>();
      
      if (monitors.results) {
        for (const monitor of monitors.results) {
          await env.DB.prepare(
            'INSERT INTO status_page_monitors (config_id, monitor_id) VALUES (?, ?)'
          ).bind(configId.id, monitor.id).run();
        }
      }
      
      // 关联所有客户端
      const agents = await env.DB.prepare('SELECT id FROM agents').all<{id: number}>();
      
      if (agents.results) {
        for (const agent of agents.results) {
          await env.DB.prepare(
            'INSERT INTO status_page_agents (config_id, agent_id) VALUES (?, ?)'
          ).bind(configId.id, agent.id).run();
        }
      }
    }
  }
}

// 初始化数据库路由
initDb.get('/init-db', async (c) => {
  // 检查环境变量是否允许数据库初始化
  if (c.env.ENABLE_DB_INIT !== 'true') {
    return c.json({
      success: false,
      message: '数据库初始化功能已禁用。若要启用，请设置环境变量 ENABLE_DB_INIT=true'
    }, 403);
  }

  try {
    console.log('开始初始化数据库...');
    
    // 先删除已有的表
    console.log('删除已有的表...');
    try {
      await c.env.DB.exec("DROP TABLE IF EXISTS status_page_agents");
      await c.env.DB.exec("DROP TABLE IF EXISTS status_page_monitors");
      await c.env.DB.exec("DROP TABLE IF EXISTS status_page_config");
      await c.env.DB.exec("DROP TABLE IF EXISTS monitor_status_history");
      await c.env.DB.exec("DROP TABLE IF EXISTS monitor_checks");
      await c.env.DB.exec("DROP TABLE IF EXISTS agents");
      await c.env.DB.exec("DROP TABLE IF EXISTS monitors");
      await c.env.DB.exec("DROP TABLE IF EXISTS users");
    } catch (error) {
      console.log('删除表出错，可能表不存在:', error);
    }
    
    // 初始化数据库
    const result = await initializeDatabase(c.env);
    
    if (result.success) {
      return c.json({ 
        success: true, 
        message: '数据库初始化成功',
        tables: ['users', 'monitors', 'monitor_checks', 'monitor_status_history', 'agents', 'status_page_config', 'status_page_monitors', 'status_page_agents']
      });
    } else {
      return c.json({ 
        success: false, 
        message: result.message
      }, 500);
    }
  } catch (error) {
    console.error('数据库初始化错误:', error);
    return c.json({ 
      success: false, 
      message: '数据库初始化失败', 
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default initDb; 