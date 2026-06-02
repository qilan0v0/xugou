"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = exports.sendAgentNotification = exports.checkAgentsStatus = exports.monitorTask = exports.runScheduledTasks = void 0;
// 导出所有定时任务
const monitor_task_1 = __importStar(require("./monitor-task"));
exports.monitorTask = monitor_task_1.default;
Object.defineProperty(exports, "sendNotification", { enumerable: true, get: function () { return monitor_task_1.sendNotification; } });
const agent_task_1 = require("./agent-task");
Object.defineProperty(exports, "checkAgentsStatus", { enumerable: true, get: function () { return agent_task_1.checkAgentsStatus; } });
Object.defineProperty(exports, "sendAgentNotification", { enumerable: true, get: function () { return agent_task_1.sendAgentNotification; } });
// 统一的定时任务处理函数
const runScheduledTasks = async (event, env, ctx) => {
    try {
        // 执行监控检查任务
        if (monitor_task_1.default.scheduled) {
            await monitor_task_1.default.scheduled(event, env, ctx);
        }
        // 执行客户端状态检查任务
        await (0, agent_task_1.checkAgentsStatus)(env);
    }
    catch (error) {
        console.error('定时任务执行出错:', error);
    }
};
exports.runScheduledTasks = runScheduledTasks;
