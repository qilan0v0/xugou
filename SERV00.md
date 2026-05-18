# Xugou 部署到 Serv00

## 前置条件

1. Serv00 账号（[serv00.com](https://www.serv00.com) 注册）
2. 控制面板放行端口（Port Management → Add → 5411）
3. SSH 已连接

## 一键部署

```bash
# 1. 进入网站目录
cd ~/domains/你的用户名.serv00.net/public_nodejs

# 2. 克隆项目
git clone https://github.com/qilan0v0/xugou.git

# 3. 安装依赖
cd xugou/backend
cp package.node.json package.json
npm install

# 4. 回退到 public_nodejs
cd ~/domains/你的用户名.serv00.net/public_nodejs

# 5. 静态文件改名（防止 Apache 覆盖 Node.js）
mv public static 2>/dev/null || true

# 6. 复制看门狗
cp xugou/backend/serv00/app.js .

# 7. 后台启动（nohup = 关终端也不停）
pkill -f "tsx src/index.node" 2>/dev/null
pkill -f "node app.js" 2>/dev/null
sleep 1
nohup node app.js > watchdog.log 2>&1 &

# 8. 验证
sleep 5
curl -s http://127.0.0.1:5411/
# 应该看到: {"message":"XUGOU API (Node.js)"}
```

## 架构说明

```
用户请求 → Cloudflare CDN (s0tzhd.qilan.sbs)
         → Serv00:5411 (看门狗 app.js)
           ├─ 每15秒检查 tsx 进程
           ├─ 挂了自动拉起
           └─ 后端监听 127.0.0.1:5411
```

## 更新代码

```bash
cd ~/domains/你的用户名.serv00.net/public_nodejs
git -C xugou pull
cp xugou/backend/serv00/app.js .
pkill -f "tsx src/index.node" 2>/dev/null
sleep 2
nohup node app.js > watchdog.log 2>&1 &
```

## 查看日志

```bash
# 看门狗日志
tail -f ~/domains/你的用户名.serv00.net/public_nodejs/watchdog.log

# 后端日志
tail -f ~/domains/你的用户名.serv00.net/public_nodejs/xugou/backend/data/backend.log
```

## 检查是否存活

```bash
ps aux | grep "tsx src/index.node"
curl -s http://127.0.0.1:5411/
```

## 默认账号

- 用户名：`admin`
- 密码：`admin123`
- 登录后立即修改密码

## 前端对接

前端配置 `VITE_API_BASE_URL` = `https://s0tzhd.qilan.sbs`（CF 代理域名）构建即可。
