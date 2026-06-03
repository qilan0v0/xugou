#!/bin/sh
# Qltz Agent Web Status Page
# Served via socat TCP-LISTEN, one process per connection

read -r request_line
method=$(echo "$request_line" | awk '{print $1}')
path=$(echo "$request_line" | awk '{print $2}')

# Read and discard headers
while read -r header; do
    header=$(echo "$header" | tr -d '\r')
    [ -z "$header" ] && break
done

generate_html() {
    HOSTNAME=$(hostname)
    UPTIME=$(uptime -s 2>/dev/null || cat /proc/uptime | awk '{print $1}')
    OS_INFO=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '"' || echo "Alpine Linux")
    KERNEL=$(uname -r)
    CPU_COUNT=$(nproc 2>/dev/null || echo "N/A")
    MEM_TOTAL=$(free -m 2>/dev/null | awk '/Mem:/{print $2}' || echo "N/A")
    MEM_USED=$(free -m 2>/dev/null | awk '/Mem:/{print $3}' || echo "N/A")
    MEM_PCT="N/A"
    if [ "$MEM_TOTAL" != "N/A" ] && [ "$MEM_USED" != "N/A" ]; then
        MEM_PCT=$(awk "BEGIN {printf \"%.1f\", ($MEM_USED/$MEM_TOTAL)*100}")
    fi
    DISK_INFO=$(df -h / 2>/dev/null | tail -1 | awk '{print $3" / "$2" ("$5")"}')
    CPU_LOAD=$(cat /proc/loadavg 2>/dev/null | awk '{print $1", "$2", "$3}' || echo "N/A")
    PROC_COUNT=$(ls -d /proc/[0-9]* 2>/dev/null | wc -l || echo "N/A")
    AGENT_PID=$(pgrep -f qltz-agent 2>/dev/null || echo "N/A")
    AGENT_VER=$(/usr/local/bin/qltz-agent version 2>/dev/null || echo "N/A")
    NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Network interfaces
    NET_IFACES=""
    for iface in $(cat /proc/net/dev 2>/dev/null | tail -n +3 | awk -F: '{print $1}' | tr -d ' '); do
        RX=$(cat /proc/net/dev | grep "$iface" | awk '{print $2}')
        TX=$(cat /proc/net/dev | grep "$iface" | awk '{print $10}')
        [ -n "$NET_IFACES" ] && NET_IFACES="$NET_IFACES,"
        NET_IFACES="$NET_IFACES{\"name\":\"$iface\",\"rx\":$RX,\"tx\":$TX}"
    done

    cat <<EOF
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Cache-Control: no-cache

<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>柒蓝轻量监控 Agent — 状态</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:24px;min-height:100vh}
h1{font-size:20px;font-weight:600;color:#f0f6fc;margin-bottom:8px}
.sub{color:#8b949e;font-size:13px;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:24px}
.card{background:#161b22;border:1px solid #21262d;border-radius:6px;padding:16px}
.card h3{font-size:12px;font-weight:500;color:#8b949e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
.card .val{font-size:20px;font-weight:600;color:#f0f6fc}
.card .unit{font-size:12px;color:#8b949e;margin-left:4px}
.metric{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #21262d}
.metric:last-child{border-bottom:none}
.metric .label{font-size:13px;color:#8b949e}
.metric .value{font-size:13px;color:#f0f6fc;font-family:monospace}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500}
.badge-ok{background:#0d3322;color:#3fb950}
.badge-warn{background:#332900;color:#d29922}
.badge-err{background:#330d0d;color:#f85149}
.footer{text-align:center;color:#484f58;font-size:11px;margin-top:24px}
.refresh{color:#58a6ff;text-decoration:none;font-size:12px}
</style>
</head>
<body>
<h1>🔍 柒蓝轻量监控 Agent</h1>
<p class="sub">系统监控探针 — <span id="time">$NOW</span> &nbsp; <a class="refresh" href="/">↻ 刷新</a></p>

<div class="grid">
<div class="card">
<h3>系统</h3>
<div class="metric"><span class="label">主机名</span><span class="value">$HOSTNAME</span></div>
<div class="metric"><span class="label">操作系统</span><span class="value">$OS_INFO</span></div>
<div class="metric"><span class="label">内核</span><span class="value">$KERNEL</span></div>
<div class="metric"><span class="label">CPU 核心</span><span class="value">$CPU_COUNT</span></div>
<div class="metric"><span class="label">进程数</span><span class="value">$PROC_COUNT</span></div>
</div>

<div class="card">
<h3>CPU 负载</h3>
<div class="val">$CPU_LOAD</div>
<div style="color:#8b949e;font-size:12px;margin-top:4px">1分钟 / 5分钟 / 15分钟</div>
</div>

<div class="card">
<h3>内存</h3>
<div class="val">$MEM_USED<span class="unit">MB</span></div>
<div style="color:#8b949e;font-size:12px;margin-top:4px">共 $MEM_TOTAL MB — 已用 ${MEM_PCT}%</div>
</div>

<div class="card">
<h3>磁盘 (/)</h3>
<div class="val">$DISK_INFO</div>
</div>

<div class="card">
<h3>Agent</h3>
<div class="metric"><span class="label">版本</span><span class="value">$AGENT_VER</span></div>
<div class="metric"><span class="label">PID</span><span class="value">$AGENT_PID</span></div>
<div class="metric"><span class="label">状态</span><span class="value"><span class="badge badge-ok">运行中</span></span></div>
<div class="metric"><span class="label">上报间隔</span><span class="value">${QLTZ_INTERVAL:-60}秒</span></div>
<div class="metric"><span class="label">服务器</span><span class="value">${QLTZ_SERVER:-未设置}</span></div>
</div>
</div>

<div class="footer">柒蓝轻量监控 Agent &copy; 2026 — 每 30 秒自动刷新 — <span id="gen">生成于 $NOW</span></div>
</body>
</html>
EOF
}

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
        generate_html
        ;;
esac
