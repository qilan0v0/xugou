#!/bin/sh
set -e

cleanup() {
    echo "Shutting down..."
    [ -n "$AGENT_PID" ] && kill "$AGENT_PID" 2>/dev/null
    [ -n "$SOCAT_PID" ] && kill "$SOCAT_PID" 2>/dev/null
    wait 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Build argument list from environment variables
ARGS=""

if [ -n "$QLTZ_SERVER" ]; then
    ARGS="$ARGS --server $QLTZ_SERVER"
fi

if [ -n "$QLTZ_TOKEN" ]; then
    ARGS="$ARGS --token $QLTZ_TOKEN"
fi

if [ -n "$QLTZ_INTERVAL" ]; then
    ARGS="$ARGS --interval $QLTZ_INTERVAL"
fi

if [ -n "$QLTZ_LOG_LEVEL" ]; then
    ARGS="$ARGS --log-level $QLTZ_LOG_LEVEL"
fi

if [ -n "$QLTZ_CONFIG" ]; then
    ARGS="$ARGS --config $QLTZ_CONFIG"
fi

# Start agent in background
/usr/local/bin/qltz-agent $ARGS "$@" &
AGENT_PID=$!
echo "Agent started (PID: $AGENT_PID)"

# Start web server in background
WEB_PORT=${QLTZ_WEB_PORT:-8080}
echo "Starting web status page on port $WEB_PORT"
socat TCP-LISTEN:${WEB_PORT},reuseaddr,fork EXEC:/app/web/serve.sh &
SOCAT_PID=$!

echo "Services running. Web: http://0.0.0.0:$WEB_PORT"
wait
