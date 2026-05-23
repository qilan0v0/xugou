#!/bin/sh
set -e

# Build argument list from environment variables
ARGS=""

if [ -n "$XUGOU_SERVER" ]; then
    ARGS="$ARGS --server $XUGOU_SERVER"
fi

if [ -n "$XUGOU_TOKEN" ]; then
    ARGS="$ARGS --token $XUGOU_TOKEN"
fi

if [ -n "$XUGOU_INTERVAL" ]; then
    ARGS="$ARGS --interval $XUGOU_INTERVAL"
fi

if [ -n "$XUGOU_LOG_LEVEL" ]; then
    ARGS="$ARGS --log-level $XUGOU_LOG_LEVEL"
fi

if [ -n "$XUGOU_CONFIG" ]; then
    ARGS="$ARGS --config $XUGOU_CONFIG"
fi

exec /usr/local/bin/xugou-agent $ARGS "$@"
