FROM alpine:3.21

ARG AGENT_VERSION=v20260519-042217
ARG AGENT_BINARY=XA-linux-amd64

RUN apk add --no-cache ca-certificates tzdata socat && \
    adduser -D -h /data xugou

COPY --chown=xugou:xugou entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY --chown=xugou:xugou web/ /app/web/
RUN chmod +x /app/web/serve.sh

ADD https://github.com/qilan0v0/xugou/releases/download/${AGENT_VERSION}/${AGENT_BINARY} /usr/local/bin/xugou-agent
RUN chmod +x /usr/local/bin/xugou-agent

ENV XUGOU_SERVER=""
ENV XUGOU_TOKEN=""
ENV XUGOU_INTERVAL=60
ENV XUGOU_LOG_LEVEL=info
ENV XUGOU_WEB_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:${XUGOU_WEB_PORT}/api/status || exit 1

USER xugou
WORKDIR /data

ENTRYPOINT ["/entrypoint.sh"]
CMD ["start"]
