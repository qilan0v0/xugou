# Qltz 部署到 Serv00

Serv00 是 FreeBSD 共享主机，配额 512MB RAM / 20 进程 / 3GB 磁盘。

## 前置条件

1. Serv00 账号（[serv00.com](https://www.serv00.com) 注册）
2. 控制面板放行端口（部署后会自动检测）

## 配置

端口和参数通过 `backend/config.serv00.json` 设置，默认 5411：

```json
{
  "port": 5411,
  "hostname": "127.0.0.1",
  "jwt_secret": "换成随机字符串",
  "enable_db_init": true,
  "db_path": "./data/qltz.db"
}
```

| 字段 | 说明 |
|------|------|
| `port` | 后端端口，看门狗自动用 `port+1` |
| `jwt_secret` | JWT 签名密钥，换成随机字符串 |

## 一键部署

```bash
# 1. 进网站目录（改成你的用户名）
cd ~/domains/你的用户名.serv00.net/public_nodejs

# 2. 克隆项目
git clone https://github.com/qilan0v0/xugou.git
cd qltz/backend

# 3. 安装依赖
npm install --omit=dev

# 4. 编译 TypeScript（必须）
npm run build:node

# 5. 复制 Passenger 入口
cp serv00/public_app.js ../app.js
```

部署完成。访问 `https://你的用户名.serv00.net/`，Passenger 自动启动看门狗和后端，之后访问都会保活。

## 更新代码

```bash
cd ~/domains/你的用户名.serv00.net/public_nodejs/qltz
git pull

# 复制最新入口（如果有变动）
cp backend/serv00/public_app.js ../app.js

# 重新构建
cd backend
npm install --omit=dev
npm run build:node

# 手动重启（或等 40 分钟自动重启）
pkill -9 -f "dist/index.node" 2>/dev/null


cd ~/domains/qilan3.serv00.net/public_nodejs/xugou
  git fetch origin && git reset --hard origin/main
  cd backend && npm run build:node
  pkill -9 -f "dist/index.node"
```

## 架构

```
https://你的用户名.serv00.net
  → Serv00 Passenger (自动保活)
    → app.js (看门狗，127.0.0.1:5412)
      → dist/index.node.js (后端，127.0.0.1:5411)
```

| 组件 | 位置 | 说明 |
|------|------|------|
| Passenger 入口 | `public_nodejs/app.js` | 自带 HTTP + WebSocket 代理的看门狗，Passenger 自动托管 |
| 后端 | `backend/dist/index.node.js` | 编译后的 Hono API |
| 数据库 | `backend/data/qltz.db` | better-sqlite3 原生模式 |

看门狗功能：
- 每 30 秒检测后端端口，挂了自动拉起
- 每 40 分钟主动重启释放内存
- 请求时发现后端不可用自动触发启动
- 128MB Node.js 堆上限
- **WebSocket 代理**：`server.on('upgrade')` 转发终端 WS 连接到后端

## 查看日志

```bash
# 后端日志
tail -f ~/domains/你的用户名.serv00.net/public_nodejs/qltz/backend/data/backend.log
```

## 检查存活

```bash
ps aux | grep "dist/index.node" | grep -v grep
curl -s http://127.0.0.1:5411/
# → {"message":"QLTZ API (Node.js)"}
```

## 常见问题

### 403 / We're sorry

删掉残留的 `.htaccess`，确认 `public_nodejs/app.js` 存在且是最新版本。

### 内存太高 / 被 kill

- 确认日志开头是 `[DB] better-sqlite3 (native)`
- 如果是 `sql.js (WASM fallback)`：`pkg install python3 gmake gcc && npm install --omit=dev better-sqlite3 && npm run build:node`
- 缩短重启间隔：编辑 `public_app.js` 中 `40 * 60 * 1000` 改小

### 后端 500 / 接口报错

构建可能没跟上源码变更：`cd backend && npm run build:node`

## 默认账号

- 用户名：`admin`
- 密码：`admin123`

## 前端对接

前端 `VITE_API_BASE_URL` 设为 `https://你的用户名.serv00.net`。
