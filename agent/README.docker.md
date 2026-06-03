# 柒蓝轻量监控 Agent · Docker 镜像

通过 GitHub Actions 自动构建的 Agent 探针镜像，内置一个 web 状态页，支持多架构（amd64 / arm64）。镜像在构建时会自动从本项目的 Releases 下载对应架构的 agent 二进制。

镜像地址：`ghcr.io/qilan0v0/qltz-agent`

---

## 快速开始

```bash
docker run -d \
  --name qltz-agent \
  --restart unless-stopped \
  -p 8080:8080 \
  -e QLTZ_SERVER="https://你的监控面板地址" \
  -e QLTZ_UUID="你的客户端令牌" \
  ghcr.io/qilan0v0/qltz-agent:latest
```

启动后访问 `http://服务器IP:8080` 查看本机状态页。

### docker-compose

```yaml
services:
  qltz-agent:
    image: ghcr.io/qilan0v0/qltz-agent:latest
    container_name: qltz-agent
    restart: unless-stopped
    ports:
      - "8080:8080"          # web 状态页（不需要可删掉）
    environment:
      QLTZ_SERVER: "https://你的监控面板地址"
      QLTZ_UUID: "你的客户端令牌"
      QLTZ_INTERVAL: "60"
    # 采集宿主机更完整信息（可选）：
    # pid: host
    # network_mode: host
```

---

## 环境变量

容器入口脚本会把下列 `QLTZ_*` 环境变量翻译成对应的 agent 命令行参数，与项目源码 `agent/cmd/agent` 中定义的 flag 一一对应。

### 连接

| 环境变量 | 对应参数 | 说明 |
|----------|----------|------|
| `QLTZ_SERVER` | `--server` / `-s` | 监控服务器地址（**必填**） |
| `QLTZ_UUID` | `--uuid` | 客户端令牌（UUID 格式，留空则自动生成并保存到配置文件） |
| `QLTZ_TOKEN` | `--uuid` | `QLTZ_UUID` 的兼容别名（旧用法，二者择一） |
| `QLTZ_PASSWORD` | `--password` / `-p` | Nezha 兼容：作用同 `--uuid` |
| `QLTZ_AGENT_ID` | `--agent-id` | 客户端 ID，需与服务器注册的 ID 一致 |
| `QLTZ_TLS` | `--tls` | Nezha 兼容：使用 TLS 连接（`true`/`1` 开启；server 未带协议时自动补 `https://`） |

### 上报

| 环境变量 | 对应参数 | 默认 | 说明 |
|----------|----------|------|------|
| `QLTZ_INTERVAL` | `--interval` / `-i` | `60` | 采集并上报间隔（秒） |
| `QLTZ_REPORT_DELAY` | `--report-delay` | — | Nezha 兼容：同 `--interval`，设置后覆盖它 |

### 采集

| 环境变量 | 对应参数 | 说明 |
|----------|----------|------|
| `QLTZ_SKIP_CONN` | `--skip-conn` | Nezha 兼容：跳过 TCP/UDP 连接数统计 |
| `QLTZ_SKIP_PROCS` | `--skip-procs` | Nezha 兼容：跳过进程数统计 |

### 日志 / 配置

| 环境变量 | 对应参数 | 默认 | 说明 |
|----------|----------|------|------|
| `QLTZ_LOG_LEVEL` | `--log-level` | `info` | 日志级别：`debug` / `info` / `warn` / `error` |
| `QLTZ_DEBUG` | `--debug` / `-d` | — | Nezha 兼容：开启 debug 日志（`true`/`1`） |
| `QLTZ_CONFIG` | `--config` | — | 指定配置文件路径 |

### 内置 web 状态页

| 环境变量 | 默认 | 说明 |
|----------|------|------|
| `QLTZ_WEB_PORT` | `8080` | 状态页监听端口 |
| `QLTZ_WEB_DISABLE` | — | 设为 `true`/`1` 则不启动状态页 |

> 布尔型变量接受 `1` / `true` / `yes` / `on`（不区分大小写）视为开启，其余视为关闭。

---

## web 状态页

镜像内置一个轻量状态页（socat + shell 实现，无额外依赖）：

- `GET /` — HTML 页面，展示主机名、系统、CPU 负载、内存、磁盘、Agent 状态，每 30 秒自动刷新
- `GET /api/status` — JSON 接口，供健康检查 / 外部采集使用

```bash
curl http://localhost:8080/api/status
# {"hostname":"...","cpu_load_1m":0.12,"mem_used_mb":120,"mem_total_mb":512,"disk_used_pct":34,"agent_running":true,"time":"..."}
```

容器自带 `HEALTHCHECK`，通过该接口判断健康状态。

---

## 自定义端口示例

```bash
docker run -d --name qltz-agent \
  -p 9000:9000 \
  -e QLTZ_WEB_PORT=9000 \
  -e QLTZ_SERVER="https://你的面板" \
  -e QLTZ_UUID="令牌" \
  ghcr.io/qilan0v0/qltz-agent:latest
```

## 透传额外参数

`docker run` 末尾的参数会原样透传给 agent，可覆盖默认 `start` 子命令：

```bash
# 查看版本
docker run --rm ghcr.io/qilan0v0/qltz-agent:latest version
```

---

## 镜像构建（维护者）

构建由 `.github/workflows/docker-build.yml` 完成：

- **触发方式**
  - 手动触发（Actions → 「构建 Agent 探针镜像」→ Run workflow）
  - 发布新 Release 时自动触发
- **版本选择**：手动触发时「Agent Release 版本标签」**留空即自动使用最新的 Release**；也可填写指定标签（如 `v20260519-042217`）
- **多架构**：默认同时构建 `linux/amd64` 和 `linux/arm64`，每个架构在构建时下载与之匹配的二进制（`qltz-agent-linux-amd64` / `qltz-agent-linux-arm64`）
- **镜像标签**：自动打 `:版本号` 和 `:latest` 两个标签，推送到 `ghcr.io/<owner>/qltz-agent`

构建参数（`build-args`）：

| 参数 | 说明 |
|------|------|
| `AGENT_VERSION` | Release 标签（工作流自动解析最新或使用指定值） |
| `BINARY_PREFIX` | 资产名前缀，默认 `qltz-agent`，下载 `前缀-linux-架构` |
| `AGENT_BINARY` | 完整资产名（留空则按前缀+架构拼装；用于兼容旧的单一资产名如 `XA-linux-amd64`） |
| `TARGETARCH` | 由 buildx 自动注入（`amd64` / `arm64`） |
