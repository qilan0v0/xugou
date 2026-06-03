#!/bin/sh
set -e

cleanup() {
    echo "正在关闭..."
    [ -n "$AGENT_PID" ] && kill "$AGENT_PID" 2>/dev/null
    [ -n "$SOCAT_PID" ] && kill "$SOCAT_PID" 2>/dev/null
    wait 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# 把布尔型环境变量归一化：1/true/yes/on 视为真
is_true() {
    case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
        1|true|yes|on) return 0 ;;
        *) return 1 ;;
    esac
}

# 子命令：默认 start，可被 docker run 的参数覆盖（如 version / help）
SUBCMD="start"
if [ "$#" -gt 0 ]; then
    case "$1" in
        start|version|help|--help|-h) SUBCMD="$1"; shift ;;
    esac
fi

# ── 由 QLTZ_* 环境变量拼装 CLI 参数 ──────────────────────────
# 与项目 cmd/agent 中定义的 flag 完全对应。
# 仅对 start 子命令拼装（version/help 等不接受这些 flag）。
ARGS=""
if [ "$SUBCMD" = "start" ]; then
    # 字符串型参数
    [ -n "$QLTZ_CONFIG" ]       && ARGS="$ARGS --config $QLTZ_CONFIG"
    [ -n "$QLTZ_SERVER" ]       && ARGS="$ARGS --server $QLTZ_SERVER"
    # UUID 令牌：QLTZ_UUID 优先，QLTZ_TOKEN 作为兼容别名
    if [ -n "$QLTZ_UUID" ]; then
        ARGS="$ARGS --uuid $QLTZ_UUID"
    elif [ -n "$QLTZ_TOKEN" ]; then
        ARGS="$ARGS --uuid $QLTZ_TOKEN"
    fi
    [ -n "$QLTZ_PASSWORD" ]     && ARGS="$ARGS --password $QLTZ_PASSWORD"
    [ -n "$QLTZ_LOG_LEVEL" ]    && ARGS="$ARGS --log-level $QLTZ_LOG_LEVEL"
    [ -n "$QLTZ_AGENT_ID" ]     && ARGS="$ARGS --agent-id $QLTZ_AGENT_ID"
    [ -n "$QLTZ_INTERVAL" ]     && ARGS="$ARGS --interval $QLTZ_INTERVAL"
    [ -n "$QLTZ_REPORT_DELAY" ] && ARGS="$ARGS --report-delay $QLTZ_REPORT_DELAY"

    # 布尔型参数（仅在为真时加入）
    is_true "$QLTZ_DEBUG"      && ARGS="$ARGS --debug"
    is_true "$QLTZ_TLS"        && ARGS="$ARGS --tls"
    is_true "$QLTZ_SKIP_CONN"  && ARGS="$ARGS --skip-conn"
    is_true "$QLTZ_SKIP_PROCS" && ARGS="$ARGS --skip-procs"
fi

# 启动 agent（子命令在前，flag 在后；额外的 docker run 参数透传到末尾）
echo "启动 Agent: qltz-agent $SUBCMD $ARGS $*"
# shellcheck disable=SC2086
/usr/local/bin/qltz-agent "$SUBCMD" $ARGS "$@" &
AGENT_PID=$!
echo "Agent 已启动 (PID: $AGENT_PID)"

# version / help 等子命令执行完即退出，不启动 web
if [ "$SUBCMD" != "start" ]; then
    wait "$AGENT_PID"
    exit $?
fi

# 启动 web 状态页
WEB_PORT=${QLTZ_WEB_PORT:-8080}
if is_true "$QLTZ_WEB_DISABLE"; then
    echo "Web 状态页已禁用 (QLTZ_WEB_DISABLE=$QLTZ_WEB_DISABLE)"
else
    echo "在端口 $WEB_PORT 启动 web 状态页"
    socat TCP-LISTEN:${WEB_PORT},reuseaddr,fork EXEC:/app/web/serve.sh &
    SOCAT_PID=$!
    echo "服务运行中。Web: http://0.0.0.0:$WEB_PORT"
fi

wait
