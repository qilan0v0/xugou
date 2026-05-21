// 导出所有定时任务
import monitorTask from './monitor-task';
import { checkAgentsStatus, sendAgentNotification } from './agent-task';

// 统一的定时任务处理函数
export const runScheduledTasks = async (event: any, env: any, ctx: any) => {
  try {
    // 执行监控检查任务
    if (monitorTask.scheduled) {
      await monitorTask.scheduled(event, env, ctx);
    }
    
    // 执行客户端状态检查任务
    await checkAgentsStatus(env);
  } catch (error) {
    console.error('定时任务执行出错:', error);
  }
};

export {
  monitorTask,
  checkAgentsStatus,
  sendAgentNotification,
}; 