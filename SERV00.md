# Xugou 部署到 Serv00

Serv00 是 FreeBSD 共享主机，配额 512MB RAM / 20 进程 / 3GB 磁盘。

## 前置条件

1. Serv00 账号（[serv00.com](https://www.serv00.com) 注册）
2. SSH 已连接
3. 控制面板放行端口：**Port Management → Add**，建议添加 `5411` 和 `5412`（或者你自定义的两个连续端口）

## 配置端口

端口通过 `backend/config.serv00.json` 设置，默认 5411：

```json
{
  "port": 5411,
  "hostname": "127.0.0.1",
  "jwt_secret": "换成随机字符串",
  "enable_db_init": true,
  "db_path": "./data/xugou.db"
}
```

| 字段 | 说明 |
|------|------|
| `port` | 后端端口；看门狗自动用 `port+1`，两个都需要在 serv00 放行 |
| `jwt_secret` | JWT 签名密钥，换成随机字符串 |

也可以用环境变量 `PORT=3000` 临时覆盖，优先级：**环境变量 > 配置文件 > 默认 5411**。

## 一键部署

```bash
# 1. 进网站目录（把 "你的用户名" 替换掉）
cd ~/domains/你的用户名.serv00.net/public_nodejs

# 2. 克隆
git clone https://github.com/qilan0v0/xugou.git
cd xugou/backend

# 3. 安装依赖（跳过 Cloudflare 专用包，FreeBSD 不兼容）
npm install --omit=dev

# 4. ⚠️ 编译 TypeScript → JavaScript（必须执行，否则跑不起来）
npm run build:node

# 5. 启动看门狗
pkill -9 -f "index.node" 2>/dev/null
pkill -9 -f "app.cjs" 2>/dev/null
sleep 2
cd serv00
nohup node app.cjs > watchdog.log 2>&1 &

# 6. 验证（5 秒后看日志第一行）
sleep 5
head -3 ../data/backend.log
# 预期: [DB] better-sqlite3 (native) 或 sql.js (WASM fallback)
#       Xugou Node.js backend on http://0.0.0.0:5411
```

## 更新代码

```bash
cd ~/domains/你的用户名.serv00.net/public_nodejs/xugou
git pull

pkill -9 -f "index.node" 2>/dev/null
pkill -9 -f "app.cjs" 2>/dev/null
sleep 2

cd backend
npm install --omit=dev
npm run build:node          # ⚠️ 每次更新必须重新编译
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
| 后端 | 5411 | 只监听 127.0.0.1，不对外开放 |

## 查看日志

```bash
# 看门狗日志
tail -f ~/domains/你的用户名.serv00.net/public_nodejs/xugou/backend/serv00/watchdog.log

# 后端日志
tail -f ~/domains/你的用户名.serv00.net/public_nodejs/xugou/backend/data/backend.log
```

## 检查存活

```bash
# 确认进程跑的是编译后的 dist/，不是源码 src/
ps aux | grep "dist/index.node" | grep -v grep

# 测 API
curl -s http://127.0.0.1:5411/
# → {"message":"XUGOU API (Node.js)"}

# 通过看门狗访问
curl -s http://127.0.0.1:5412/
# → 同样结果，代理正常

# RAM 应该在 30~50%（150~250MB）
```

## 常见问题

### 报错 `require is not defined in ES module scope`

说明跑的是源码 `src/index.node.ts` 而不是编译后的 `dist/index.node.js`。**必须执行 `npm run build:node`**，看门狗会自动跑 `dist/` 下的编译产物。

### 报错 `listen EPERM ... port: XXXX`

端口未在 serv00 控制面板放行。去 **Port Management** 添加端口，或修改 `config.serv00.json` 里的 `port` 值。

### 内存太高 / 被 kill

- 确认日志有 `[DB] better-sqlite3 (native)`，如果是 `sql.js (WASM fallback)` 说明没装上原生模块
- 装编译工具后重装：`pkg install python3 gmake gcc && npm install --omit=dev better-sqlite3 && npm run build:node`
- 缩短重启间隔：`RESTART_MINUTES=20`

## 默认账号

- 用户名：`admin`
- 密码：`admin123`
- 登录后立即修改密码

## 前端对接

前端 `VITE_API_BASE_URL` 设为 `https://你的域名`（经 Cloudflare 代理到 Serv00:5412）。
