# Qltz Agent 探针镜像
# 多阶段构建：从源码编译 agent，无需下载 Release 二进制

# ── 构建阶段 ──────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build
COPY agent/go.mod agent/go.sum ./
RUN go mod download

COPY agent/ ./
RUN CGO_ENABLED=0 go build -v -ldflags="-s -w -X github.com/xugou/agent/pkg/collector.Version=$(git describe --tags --always 2>/dev/null || echo 'docker')" -o /usr/local/bin/qltz-agent .

# ── 运行阶段 ──────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata socat wget && \
    adduser -D -h /data qltz

COPY --chown=qltz:qltz agent/entrypoint.sh /entrypoint.sh
COPY --chown=qltz:qltz agent/web/ /app/web/
RUN chmod +x /entrypoint.sh /app/web/serve.sh

COPY --from=builder /usr/local/bin/qltz-agent /usr/local/bin/qltz-agent

# ── 可配置环境变量 ──────────────────────────────────────────
# 连接
ENV QLTZ_SERVER=""
ENV QLTZ_UUID=""
ENV QLTZ_TOKEN=""
ENV QLTZ_PASSWORD=""
ENV QLTZ_AGENT_ID=""
ENV QLTZ_TLS=""
# 上报
ENV QLTZ_INTERVAL="60"
ENV QLTZ_REPORT_DELAY=""
# 采集
ENV QLTZ_SKIP_CONN=""
ENV QLTZ_SKIP_PROCS=""
# 日志 / 配置
ENV QLTZ_LOG_LEVEL="info"
ENV QLTZ_DEBUG=""
ENV QLTZ_CONFIG=""
# 内置 web 状态页
ENV QLTZ_WEB_PORT="8080"
ENV QLTZ_WEB_DISABLE=""

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- "http://localhost:${QLTZ_WEB_PORT}/api/status" >/dev/null 2>&1 || exit 1

USER qltz
WORKDIR /data

ENTRYPOINT ["/entrypoint.sh"]
CMD ["start"]