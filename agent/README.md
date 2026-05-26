# Qltz Agent

Qltz Agent 是轻量化系统监控客户端，收集 CPU、内存、磁盘、网络、进程数、TCP/UDP 连接数等指标，定期上报到 [Qltz 监控平台](https://github.com/qilan0v0/xugou)。兼容 Nezha v0/v1 启动参数。

## 采集指标

| 类别 | 指标 |
|------|------|
| 系统 | 主机名、OS、平台版本、启动时间 |
| CPU | 使用率、型号、架构、核心数、1/5/15 分钟负载 |
| 内存 | 总量、已用、可用、使用率 |
| 磁盘 | 各分区总量、已用、使用率、文件系统类型 |
| 网络 | 各网卡收发字节/包数，累计总流量 |
| 进程 | 系统进程总数 |
| 连接 | TCP 连接数、UDP 连接数 |

## 安装

### 预编译二进制

从 [Releases](https://github.com/qilan0v0/xugou/releases) 下载对应平台的二进制文件，重命名为 `qltz-agent`（Windows 为 `qltz-agent.exe`）。

### 从源码构建

```bash
git clone https://github.com/qilan0v0/xugou.git
cd qltz/agent
go build -o qltz-agent .
```

## 快速开始

```bash
# 通过管理后台创建客户端，获取 UUID Token
# https://你的域名/agents

# 启动 agent（使用 Qltz 原生参数）
./qltz-agent start -s https://你的域名 -p 你的UUID令牌

# 或者使用 Nezha 风格参数
./qltz-agent start -s 你的域名:5411 --password 你的UUID令牌 --tls -d
```

## 完整参数列表

### 原生参数

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--server` | `-s` | — | 服务器地址（必填） |
| `--uuid` | — | 自动生成 | API 令牌（UUID 格式） |
| `--config` | — | `~/.qltz-agent.yaml` | 配置文件路径 |
| `--log-level` | — | `info` | 日志级别（debug/info/warn/error） |
| `--agent-id` | — | 0 | 客户端 ID |
| `--interval` | `-i` | `60` | 上报间隔（秒） |

### Nezha v0 兼容参数

| 参数 | 简写 | 映射到 | 说明 |
|------|------|--------|------|
| `-s` | — | `--server` | 服务器地址（同原生） |
| `--password` | `-p` | `--uuid` | 认证令牌 |
| `--debug` | `-d` | `--log-level debug` | 开启调试日志 |
| `--tls` | — | 自动加 `https://` | TLS 连接 |
| `--report-delay` | — | `--interval` | 上报间隔 |
| `--skip-conn` | — | — | 跳过 TCP/UDP 连接统计 |
| `--skip-procs` | — | — | 跳过进程数统计 |

### Nezha v1 配置文件兼容

Qltz Agent 可以直接读取 Nezha v1 的 `config.yaml`：

```yaml
# config.yaml — Nezha v1 格式
client_secret: YOUR_TOKEN        # → uuid
server: monitor.example.com:8008 # → server
tls: true
report_delay: 30                 # → interval
skip_connection_count: true      # → skip_conn
skip_procs_count: true           # → skip_procs
insecure_tls: false
```

```bash
./qltz-agent start -c config.yaml
```

### Nezha v0 命令行示例

```bash
# 最简启动
./qltz-agent start -s 1.2.3.4:8008 -p YOUR_KEY

# TLS + 调试模式，30 秒间隔，跳过连接和进程统计
./qltz-agent start -s 1.2.3.4:8008 -p YOUR_KEY --tls -d --report-delay 30 --skip-conn --skip-procs
```

## 配置文件

默认读取 `~/.qltz-agent.yaml`。首次启动自动生成并保存 UUID。

```yaml
server: https://monitor.example.com
uuid: 550e8400-e29b-41d4-a716-446655440000
interval: 60
log_level: info
```

所有参数也支持环境变量（前缀 `QLTZ_`）：

```bash
export QLTZ_SERVER=https://monitor.example.com
export QLTZ_UUID=550e8400-e29b-41d4-a716-446655440000
export QLTZ_INTERVAL=60
```

## 首次上报延迟

当 **未显式设置** `--interval` 或 `--report-delay` 时，agent 会在 0~59 秒内随机延迟首次上报，避免大量 agent 同时启动时冲击服务器。显式设置间隔则立即上报。

## 生成客户端启动命令

管理后台 `/agents` 页面，点击 agent 详情卡片的 **复制** 按钮，自动生成当前 agent 的完整启动命令。

## 项目结构

```
agent/
├── main.go
├── cmd/agent/
│   ├── root.go      # 根命令、全局参数
│   ├── start.go     # start 子命令、采集上报逻辑
│   ├── config.go    # config 子命令
│   └── version.go   # version 子命令
├── pkg/
│   ├── collector/   # 系统指标采集（gopsutil）
│   └── reporter/    # HTTP/Console 上报器
└── go.mod
```

## 依赖

- Go 1.18+
- [cobra](https://github.com/spf13/cobra) — CLI 框架
- [viper](https://github.com/spf13/viper) — 配置管理
- [gopsutil](https://github.com/shirou/gopsutil) — 系统指标采集

## 许可证

MIT
