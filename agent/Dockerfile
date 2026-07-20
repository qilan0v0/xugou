# Qltz Agent 探针镜像
# 多阶段构建：Go 编译 .so + Node.js 通过 koffi 加载运行

# ── 构建阶段：编译 agent .so ──────────────────────────────
FROM golang:1.24-bookworm AS builder

RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . ./
RUN CGO_ENABLED=1 go build -buildmode=c-shared -tags cshared \
    -ldflags="-s -w -X github.com/xugou/agent/pkg/collector.Version=$(git describe --tags --always 2>/dev/null || echo 'docker')" \
    -o /usr/local/lib/qltz-agent.so .

# ── 运行阶段：Node.js + koffi 加载 .so ─────────────────────
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata && \
    rm -rf /var/lib/apt/lists/* && \
    adduser --disabled-password --gecos '' --home /data qltz

WORKDIR /app

# 安装 koffi（FFI 加载 .so）
RUN npm init -y && npm install koffi@^2.9.0

# 复制入口脚本和 .so
COPY --from=builder /usr/local/lib/qltz-agent.so /usr/local/lib/qltz-agent.so
COPY entrypoint.js /app/entrypoint.js
COPY web/index.html /app/web/index.html

# ── 可配置环境变量 ──────────────────────────────────────────
ENV QLTZ_SERVER=""
ENV QLTZ_UUID=""
ENV QLTZ_TOKEN=""
ENV QLTZ_PASSWORD=""
ENV QLTZ_TLS=""
ENV QLTZ_INTERVAL="60"
ENV QLTZ_REPORT_DELAY=""
ENV QLTZ_SKIP_CONN=""
ENV QLTZ_SKIP_PROCS=""
ENV QLTZ_LOG_LEVEL="info"
ENV QLTZ_DEBUG=""
ENV QLTZ_CONFIG=""
ENV QLTZ_WEB_PORT="8080"
ENV QLTZ_WEB_DISABLE=""

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- "http://localhost:${QLTZ_WEB_PORT}/api/status" >/dev/null 2>&1 || exit 1

USER qltz
WORKDIR /data

ENTRYPOINT ["node", "/app/entrypoint.js"]