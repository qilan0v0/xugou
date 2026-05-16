/**
 * 数据库初始化检查
 * 用于应用启动时检测数据库是否为空，如果为空则初始化
 */
import { Bindings } from '../models/db';
export declare function runMigrations(env: Bindings): Promise<void>;
export declare function checkAndInitializeDatabase(env: Bindings): Promise<{
    initialized: boolean;
    message: string;
}>;
