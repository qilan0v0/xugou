# Qltz Agent 探针镜像
# 自动从项目 Releases 下载对应架构的 agent 二进制
FROM alpine:3.21

# 由 buildx 自动注入：linux/amd64 → amd64，linux/arm64 → arm64
ARG TARGETARCH
# 由工作流传入：要下载的 Release 标签（默认 latest 由工作流解析后传入具体 tag）
ARG AGENT_VERSION
# Release 资产名前缀，最终下载 ${BINARY_PREFIX}-linux-${TARGETARCH}（当前 Release 用 XA）
ARG BINARY_PREFIX=XA
# 完整二进制名（留空则按 前缀+架构 自动拼装；指定后只下载它）
ARG AGENT_BINARY=""
ARG REPO=qilan0v0/xugou

RUN apk add --no-cache ca-certificates tzdata socat wget && \
    adduser -D -h /data qltz

COPY --chown=qltz:qltz entrypoint.sh /entrypoint.sh
COPY --chown=qltz:qltz web/ /app/web/
RUN chmod +x /entrypoint.sh /app/web/serve.sh

# 下载与目标架构匹配的二进制。
# 依次尝试候选名（兼容 XA / qltz-agent 两种命名），第一个成功即用。
RUN set -eu; \
    base="https://github.com/${REPO}/releases/download/${AGENT_VERSION}"; \
    if [ -n "${AGENT_BINARY}" ]; then \
        candidates="${AGENT_BINARY}"; \
    else \
        candidates="${BINARY_PREFIX}-linux-${TARGETARCH} XA-linux-${TARGETARCH} qltz-agent-linux-${TARGETARCH}"; \
    fi; \
    ok=0; \
    for name in $candidates; do \
        url="${base}/${name}"; \
        echo "尝试下载: $url"; \
        if wget -q -O /usr/local/bin/qltz-agent "$url"; then echo "成功: $name"; ok=1; break; fi; \
        echo "未找到: $name"; \
    done; \
    if [ "$ok" -ne 1 ]; then echo "错误: 在 Release ${AGENT_VERSION} 中找不到 linux/${TARGETARCH} 二进制（已尝试: $candidates）"; exit 1; fi; \
    chmod +x /usr/local/bin/qltz-agent; \
    /usr/local/bin/qltz-agent version || true

# ── 可配置环境变量（详见 agent/README.docker.md）──────────────
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
