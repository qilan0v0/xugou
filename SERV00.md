# Xugou 部署到 Serv00

Serv00 是 FreeBSD 共享主机，配额 512MB RAM / 20 进程 / 3GB 磁盘。

## 前置条件

1. Serv00 账号（[serv00.com](https://www.serv00.com) 注册）
2. 控制面板放行端口（Port Management → Add → 5411、5412）

## 一键部署

```bash
# 1. 进你的网站目录（用户名改成自己的）
cd ~/domains/你的用户名.serv00.net/public_nodejs

# 2. 克隆
git clone https://github.com/qilan0v0/xugou.git
cd xugou/backend

# 3. 安装依赖（跳过 Cloudflare 专用包，避免 FreeBSD 不兼容）
npm install --omit=dev

# 4. 编译 TypeScript
npm run build:node

# 5. 后台启动看门狗
pkill -9 -f "index.node" 2>/dev/null
pkill -9 -f "app.cjs" 2>/dev/null
sleep 2
cd serv00
nohup node app.cjs > watchdog.log 2>&1 &

# 6. 验证（等 5 秒看日志）
sleep 5
head -3 ../data/backend.log
# 预期: [DB] better-sqlite3 (native) 或 sql.js (WASM fallback)
```

## 更新代码

```bash
cd ~/domains/你的用户名.serv00.net/public_nodejs/xugou
git pull

# 全杀重启
pkill -9 -f "index.node" 2>/dev/null
pkill -9 -f "app.cjs" 2>/dev/null
sleep 2

cd backend
npm install --omit=dev
npm run build:node
cd serv00
nohup node app.cjs > watchdog.log 2>&1 &
```

## 架构说明

```
用户请求 → Cloudflare CDN → Serv00:5412 (看门狗 app.cjs)
                              ├─ 代理 HTTP + WebSocket → 127.0.0.1:5411 (后端)
                              ├─ 每 30s 检测端口，挂了自动拉起
                              ├─ 每 40min 主动重启释放累积内存
                              └─ 502 响应时自动触发重启
```

| 组件 | 端口 | 说明 |
|------|------|------|
| 看门狗 | 5412 | 对外端口，反向代理到后端 |
| 后端 | 5411 | 只监听 127.0.0.1，不对外 |

## 环境变量

```bash
# 启动时自定义
PORT=5411 RESTART_MINUTES=30 nohup node app.cjs > watchdog.log 2>&1 &
```

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 5411 | 后端端口，看门狗 = PORT+1 |
| `RESTART_MINUTES` | 40 | 定时重启间隔，防止内存泄漏累积 |

## 内存优化说明

本次部署做了以下优化，将 RAM 从 1GB 降至 ~180MB：

1. **更好的数据库**：优先使用 `better-sqlite3`（原生 C 库，磁盘直读）；如果 FreeBSD 没编译工具无法安装，自动回退到 `sql.js` (WASM) + 128MB 堆限制
2. **预编译 TypeScript**：`npx tsc` 编译为 JS 再运行，不再在运行时加载 tsx 编译器
3. **堆内存限制**：`--max-old-space-size=128` 防止 V8 无限制膨胀
4. **定时重启**：每 40 分钟主动重启，兜底释放任何泄漏

想要原生模式（更低内存），在 Serv00 上装编译工具后重装：

```bash
pkg install python3 gmake gcc
cd ~/domains/你的用户名.serv00.net/public_nodejs/xugou/backend
npm install --omit=dev better-sqlite3
npm run build:node
# 重启后日志显示 [DB] better-sqlite3 (native, disk-based)
```

## 查看日志

```bash
# 看门狗日志
tail -f ~/domains/你的用户名.serv00.net/public_nodejs/xugou/backend/serv00/watchdog.log

# 后端日志
tail -f ~/domains/你的用户名.serv00.net/public_nodejs/xugou/backend/data/backend.log
```

## 检查存活

```bash
# 看进程
ps aux | grep "dist/index.node" | grep -v grep

# 测试 API
curl -s http://127.0.0.1:5411/
# → {"message":"XUGOU API (Node.js)"}

# 通过看门狗访问
curl -s http://127.0.0.1:5412/
# → 同样结果，说明代理正常

# Serv00 配额面板
# RAM 应该稳定在 30~50%（150~250MB）
```

## 默认账号

- 用户名：`admin`
- 密码：`admin123`
- 登录后立即修改

## 前端对接

前端 `VITE_API_BASE_URL` 设为 `https://你的域名`（经 Cloudflare 代理到 Serv00:5412）构建即可。
