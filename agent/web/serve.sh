#!/bin/sh
# Agent Web Status Page
# Serves static HTML for /, and JSON status for /api/status
# Served via socat TCP-LISTEN, one process per connection

read -r request_line
method=$(echo "$request_line" | awk '{print $1}')
path=$(echo "$request_line" | awk '{print $2}')

# Read and discard headers
while read -r header; do
    header=$(echo "$header" | tr -d '\r')
    [ -z "$header" ] && break
done

generate_json() {
    printf 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n'
    HOSTNAME=$(hostname)
    MEM_TOTAL=$(free -m 2>/dev/null | awk '/Mem:/{print $2}' || echo "0")
    MEM_USED=$(free -m 2>/dev/null | awk '/Mem:/{print $3}' || echo "0")
    CPU_LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1}' || echo "0")
    DISK_PCT=$(df -h / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%' || echo "0")
    echo "{\"hostname\":\"$HOSTNAME\",\"cpu_load_1m\":$CPU_LOAD,\"mem_used_mb\":$MEM_USED,\"mem_total_mb\":$MEM_TOTAL,\"disk_used_pct\":$DISK_PCT,\"agent_running\":true,\"time\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
}

case "$path" in
    /api/status|/api/status/)
        generate_json
        ;;
    *)
        # Serve static HTML
        HTML_FILE="$(dirname "$0")/index.html"
        if [ -f "$HTML_FILE" ]; then
            LENGTH=$(wc -c < "$HTML_FILE")
            printf 'HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-cache\r\nContent-Length: %s\r\n\r\n' "$LENGTH"
            cat "$HTML_FILE"
        else
            printf 'HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n'
            echo "<html><body><h1>Agent Running</h1></body></html>"
        fi
        ;;
esac