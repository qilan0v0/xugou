/**
 * 数据库初始化检查
 * 用于应用启动时检测数据库是否为空，如果为空则初始化
 */
import { Bindings } from '../models/db';
import { 
  createTables, 
  createAdminUser, 
  addSampleMonitors, 
  addSampleAgents, 
  createDefaultStatusPage 
} from './database';

// 运行 D1 迁移（安全重复执行）
export async function runMigrations(env: Bindings): Promise<void> {
  const newAgentColumns = [
    'public INTEGER DEFAULT 1',
  ];
  for (const col of newAgentColumns) {
    try { await env.DB.exec(`ALTER TABLE agents ADD COLUMN ${col}`); }
    catch (e) { /* skip */ }
  }
  try { await env.DB.exec('ALTER TABLE monitors ADD COLUMN public INTEGER DEFAULT 1'); } catch (e) { /* skip */ }
  try { await env.DB.exec('ALTER TABLE monitors ADD COLUMN tags TEXT'); } catch (e) { /* skip */ }
  try { await env.DB.exec('CREATE TABLE IF NOT EXISTS agent_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)'); } catch (e) { /* skip */ }
  try { await env.DB.exec('ALTER TABLE agents ADD COLUMN sort_order INTEGER DEFAULT 0'); } catch (e) { /* skip */ }
  try { await env.DB.exec('ALTER TABLE monitors ADD COLUMN sort_order INTEGER DEFAULT 0'); } catch (e) { /* skip */ }
  try { await env.DB.exec("CREATE TABLE IF NOT EXISTS webhook_config (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, webhook_url TEXT DEFAULT '', webhook_method TEXT DEFAULT 'POST', webhook_content_type TEXT DEFAULT 'json', webhook_body_down TEXT DEFAULT '{\"name\":\"{name}\",\"status\":\"故障\"}', webhook_body_up TEXT DEFAULT '{\"name\":\"{name}\",\"status\":\"已恢复\"}', webhook_headers TEXT DEFAULT '', webhook_tls_verify INTEGER DEFAULT 1, notify_down INTEGER DEFAULT 1, notify_up INTEGER DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id))"); } catch (e) { /* skip */ }
  try { await env.DB.exec("CREATE TABLE IF NOT EXISTS agent_metrics_history (id INTEGER PRIMARY KEY AUTOINCREMENT, agent_id INTEGER NOT NULL, timestamp TEXT NOT NULL, cpu REAL, mem_pct REAL, disk_pct REAL, net_rx REAL, net_tx REAL, FOREIGN KEY (agent_id) REFERENCES agents(id))"); } catch (e) { /* skip */ }
  try { await env.DB.exec("CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_ts ON agent_metrics_history(agent_id, timestamp)"); } catch (e) { /* skip */ }

  try { await env.DB.exec("ALTER TABLE agents ADD COLUMN process_count INTEGER DEFAULT 0"); } catch (e) { /* skip */ }
  try { await env.DB.exec("ALTER TABLE agents ADD COLUMN tcp_count INTEGER DEFAULT 0"); } catch (e) { /* skip */ }
  try { await env.DB.exec("ALTER TABLE agents ADD COLUMN udp_count INTEGER DEFAULT 0"); } catch (e) { /* skip */ }
  try { await env.DB.exec("ALTER TABLE agent_metrics_history ADD COLUMN process_count INTEGER DEFAULT 0"); } catch (e) { /* skip */ }
  try { await env.DB.exec("ALTER TABLE agent_metrics_history ADD COLUMN tcp_count INTEGER DEFAULT 0"); } catch (e) { /* skip */ }
  try { await env.DB.exec("ALTER TABLE agent_metrics_history ADD COLUMN udp_count INTEGER DEFAULT 0"); } catch (e) { /* skip */ }
  try { await env.DB.exec("ALTER TABLE agents ADD COLUMN remark TEXT DEFAULT ''"); } catch (e) { /* skip */ }
  try { await env.DB.exec("ALTER TABLE webhook_config ADD COLUMN agent_notify_down INTEGER DEFAULT 1"); } catch (e) { /* skip */ }
  try { await env.DB.exec("ALTER TABLE webhook_config ADD COLUMN agent_notify_up INTEGER DEFAULT 1"); } catch (e) { /* skip */ }

  const newColumns = [
    'cpu_arch TEXT',
    'cpu_model_name TEXT',
    'cpu_cores INTEGER',
    'load1 REAL',
    'load5 REAL',
    'load15 REAL',
    'boot_time TEXT',
    'network_rx_total INTEGER',
    'network_tx_total INTEGER',
    'agent_version TEXT',
    'country TEXT',
    'connected_at TEXT',
    'last_payload TEXT',
    'traffic_limit INTEGER',
    'expiry_time TEXT',
    'start_time TEXT',
    'duration_value INTEGER',
    'duration_unit TEXT',
    'category TEXT',
    'tags TEXT',
    'public INTEGER DEFAULT 1',
  ];
  for (const col of newColumns) {
    try {
      await env.DB.exec(`ALTER TABLE agents ADD COLUMN ${col}`);
      console.log(`Migration: added column ${col}`);
    } catch (e) { /* column likely already exists, skip */ }
  }
}

// 检查并初始化数据库
export async function checkAndInitializeDatabase(env: Bindings): Promise<{ initialized: boolean, message: string }> {
  try {
    console.log('检查数据库是否需要初始化...');
    
    // 检查用户表是否存在，如果不存在或为空则需要初始化
    let hasUsers = false;

    try {
      const userCount = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
      if (userCount && userCount.count > 0) {
        hasUsers = true;
      }
    } catch (error) {
      console.log('检查表出错，表可能不存在:', error);
    }

    if (hasUsers) {
      console.log('数据库已初始化，运行迁移...');
      await runMigrations(env);
      return { initialized: false, message: '数据库已经初始化，已运行迁移' };
    }

    // 新数据库：创建表、初始化
    console.log('开始初始化数据库...');
    await createTables(env);

    // 运行迁移（确保所有列都存在）
    await runMigrations(env);
    
    // 创建管理员用户（复用database.ts中的函数）
    await createAdminUser(env);
    
    // 添加示例数据（复用database.ts中的函数）
    await addSampleMonitors(env);
    await addSampleAgents(env);
    
    // 创建默认状态页配置（复用database.ts中的函数）
    await createDefaultStatusPage(env);
    
    return {
      initialized: true,
      message: '数据库初始化成功',
    };
  } catch (error) {
    console.error('数据库初始化检查错误:', error);
    throw error;
  }
} 