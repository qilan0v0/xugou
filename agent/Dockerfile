FROM alpine:3.21

ARG AGENT_VERSION=v20260519-042217
ARG AGENT_BINARY=XA-linux-amd64

RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -h /data xugou

COPY --chown=xugou:xugou entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ADD https://github.com/qilan0v0/xugou/releases/download/${AGENT_VERSION}/${AGENT_BINARY} /usr/local/bin/xugou-agent
RUN chmod +x /usr/local/bin/xugou-agent

ENV XUGOU_SERVER=""
ENV XUGOU_TOKEN=""
ENV XUGOU_INTERVAL=60
ENV XUGOU_LOG_LEVEL=info

USER xugou
WORKDIR /data

ENTRYPOINT ["/entrypoint.sh"]
CMD ["start"]
