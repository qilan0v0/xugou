// 定期检查客户端状态的任务
export const checkAgentsStatus = async (env: any) => {
  try {
    console.log('定时任务: 检查客户端状态...');
    
    // 如果超过2分钟没有上报，将状态设置为inactive
    const inactiveThreshold = 2 * 60 * 1000;
    const now = new Date();
    
    // 查询所有状态为active的客户端
    const activeAgents = await env.DB.prepare(
      "SELECT id, name, updated_at FROM agents WHERE status = 'active'"
    ).all();
    
    if (!activeAgents.results || activeAgents.results.length === 0) {
      console.log('定时任务: 没有活跃状态的客户端');
      return;
    }
    
    // 检查每个活跃客户端的最后更新时间
    for (const agent of activeAgents.results) {
      const lastUpdateTime = new Date(agent.updated_at);
      const timeDiff = now.getTime() - lastUpdateTime.getTime();
      
      // 超过2分钟无上报则标记离线
      if (timeDiff > inactiveThreshold) {
        console.log(`定时任务: 客户端 ${agent.name} (ID: ${agent.id}) 超过2分钟未上报，设置为离线`);
        
        // 更新客户端状态为inactive
        await env.DB.prepare(
          "UPDATE agents SET status = 'inactive' WHERE id = ?"
        ).bind(agent.id).run();
      }
    }
    
  } catch (error) {
    console.error('定时任务: 检查客户端状态出错:', error);
  }
}; 