import { Hono } from 'hono';
import { Bindings } from '../models/db';
declare const initDb: Hono<{
    Bindings: Bindings;
}, import("hono/types").BlankSchema, "/">;
export declare function createTables(env: Bindings): Promise<void>;
export declare function createAdminUser(env: Bindings): Promise<void>;
export declare function addSampleMonitors(env: Bindings): Promise<void>;
export declare function addSampleAgents(env: Bindings): Promise<void>;
export declare function initializeDatabase(env: Bindings): Promise<{
    success: boolean;
    message: string;
}>;
export declare function createDefaultStatusPage(env: Bindings): Promise<void>;
export default initDb;
