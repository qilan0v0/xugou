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
    let tablesExist = true;
    
    try {
      // 尝试查询用户表
      const userCount = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>();
      
      // 如果数据库中已经有用户，则不需要初始化
      if (userCount && userCount.count > 0) {
        console.log('数据库已初始化，运行迁移...');
        await runMigrations(env);
        return {
          initialized: false,
          message: '数据库已经初始化，已运行迁移',
        };
      }
    } catch (error) {
      console.log('检查表出错，表可能不存在:', error);
      tablesExist = false;
    }
    
    // 如果表不存在或为空，则进行初始化
    console.log('开始初始化数据库...');
    
    // 创建表（只有在表不存在时才创建）
    if (!tablesExist) {
      // 使用database.ts中的函数创建表
      await createTables(env);
    }

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