# QLTZ — 柒蓝轻量监控

基于 Cloudflare Workers + Serv00 的轻量化监控平台，支持服务器探针、API 监控、公开状态页。

[English](./README_EN.md) | 简体中文

## 功能

| 模块 | 功能 |
|------|------|
| **Agent 探针** | CPU、内存、磁盘、网络流量、进程数、TCP/UDP 连接数实时采集上报，兼容 Nezha v0/v1 启动参数 |
| **API 监控** | HTTP/HTTPS 接口定时检查，支持自定义请求方法/头/体，响应时间与状态码检测 |
| **客户端管理** | 在线/离线状态、流量限制、到期时间、分组标签、管理员备注 |
| **历史图表** | CPU/内存/磁盘/网络/进程/TCP/UDP 面积图，支持 1h/6h/24h 时间范围 |
| **公开状态页** | 可自定义标题/Logo/CSS，三档卡片布局切换（大/中/小），不登录即可查看 |
| **告警通知** | Webhook 通知，API 监控与客户端监控独立开关和消息模板 |
| **多种部署** | Cloudflare Workers（前后端一体）、Serv00（Node.js）、Docker |

## 系统架构

```
Agent (Go) → Backend (Hono + SQLite) → Frontend (React + TypeScript)
  │              │                           │
  │ 采集上报      │ 存储 / API / WebSocket     │ 仪表盘 / 状态页
  │              │                           │
  └──────────────┴───────────────────────────┘
            Cloudflare Workers / Serv00 / Docker
```

## 快速部署

### Serv00（推荐免费方案）

```bash
cd ~/domains/你的用户名.serv00.net/public_nodejs
git clone https://github.com/qilan0v0/xugou.git
cd xugou/backend
npm install --omit=dev
npm run build:node
cp serv00/public_app.js ../../app.js
# 访问 https://你的用户名.serv00.net/
```

详见 [SERV00.md](./SERV00.md)

### Docker

```bash
docker run -d -p 8080:8080 \
  -e QLTZ_SERVER=https://your-server.com \
  -e QLTZ_UUID=your-token \
  ghcr.io/qilan0v0/qltz-agent:latest
```

镜像内置 web 状态页（默认 8080），多架构（amd64/arm64），构建时自动拉取最新 Release。完整环境变量与说明见 [agent/README.docker.md](./agent/README.docker.md)

### Cloudflare Workers

```bash
cd backend
npm install
npx wrangler deploy
```

### 前端

```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --branch=main
```

## Agent 部署

从 [Releases](https://github.com/qilan0v0/xugou/releases) 下载对应平台的二进制：

```bash
# Xugou 原生参数
./qltz-agent start -s https://your-server.com --uuid YOUR_TOKEN

# Nezha v0 兼容
./qltz-agent start -s server:8008 -p YOUR_KEY --tls

# Nezha v1 配置文件
./qltz-agent start -c config.yaml
```

详细参数见 [agent/README.md](./agent/README.md)

## 项目结构

```
├── agent/          # Go 探针（采集、上报、Nezha 兼容）
├── backend/        # Hono API 服务（Cloudflare Workers + Node.js）
├── frontend/       # React 仪表盘
├── workers.js      # CF Workers 入口
└── .github/        # CI/CD
```

## 许可证

MIT
