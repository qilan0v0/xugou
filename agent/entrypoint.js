#!/usr/bin/env node
// Agent entrypoint — loads agent .so via koffi, serves translator HTML
const fs = require('fs');
const path = require('path');
const http = require('http');
const koffi = require('koffi');

// ── 环境变量 ──────────────────────────────────────────────
const SERVER    = process.env.QLTZ_SERVER    || '';
const UUID      = process.env.QLTZ_UUID      || process.env.QLTZ_TOKEN || '';
const PASSWORD  = process.env.QLTZ_PASSWORD  || '';
const TLS       = /^(1|true|yes|on)$/i.test(process.env.QLTZ_TLS || '');
const INTERVAL  = parseInt(process.env.QLTZ_INTERVAL || '60', 10);
const WEB_PORT  = parseInt(process.env.QLTZ_WEB_PORT || '8080', 10);
const WEB_DISABLE = /^(1|true|yes|on)$/i.test(process.env.QLTZ_WEB_DISABLE || '');
const LOG_LEVEL = process.env.QLTZ_LOG_LEVEL || 'info';

const LIB_PATH = '/usr/local/lib/qltz-agent.so';

// ── 构建 payload ──────────────────────────────────────────
function buildPayload() {
    const args = ['-s', SERVER, '-p', UUID || PASSWORD];
    if (TLS) args.push('--tls');
    if (INTERVAL > 0) { args.push('--interval', String(INTERVAL)); }
    return JSON.stringify(args);
}

// ── 加载 .so 并启动 agent ─────────────────────────────────
function startAgent() {
    if (!SERVER) {
        console.log('[agent] QLTZ_SERVER not set, skipping agent start');
        return null;
    }

    if (!fs.existsSync(LIB_PATH)) {
        console.error(`[agent] Library not found: ${LIB_PATH}`);
        return null;
    }

    try {
        const lib = koffi.load(LIB_PATH);
        const startFn = lib.func('int StartNezhaAgent(str)');
        const stopFn  = lib.func('int StopNezhaAgent()');

        const payload = buildPayload();
        console.log(`[agent] starting with server=${SERVER} uuid=${(UUID || PASSWORD).slice(0, 8)}...`);

        startFn.async(payload, (err, code) => {
            if (err) {
                console.error(`[agent] start failed: ${err.message}`);
            } else if (code !== 0) {
                console.warn(`[agent] exited with code ${code}`);
            } else {
                console.log('[agent] started successfully');
            }
        });

        return { lib, stopFn };
    } catch (err) {
        console.error(`[agent] failed to load library: ${err.message}`);
        return null;
    }
}

// ── HTTP 服务器（翻译器页面） ────────────────────────────
function startHttpServer() {
    const HTML_PATH = path.join(__dirname, 'web', 'index.html');
    let htmlContent = '';

    try {
        htmlContent = fs.readFileSync(HTML_PATH, 'utf-8');
    } catch {
        htmlContent = '<html><body><h1>Agent Running</h1></body></html>';
    }

    const server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://localhost`);

        if (url.pathname === '/api/status') {
            // Health check endpoint
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                hostname: require('os').hostname(),
                agent_running: true,
                time: new Date().toISOString()
            }));
            return;
        }

        // Serve translator HTML
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
        });
        res.end(htmlContent);
    });

    server.listen(WEB_PORT, '0.0.0.0', () => {
        console.log(`[web] serving on http://0.0.0.0:${WEB_PORT}`);
    });

    return server;
}

// ── 信号处理 ──────────────────────────────────────────────
let agentHandle = null;
let httpServer = null;

function shutdown() {
    console.log('\n[agent] shutting down...');
    if (agentHandle && agentHandle.stopFn) {
        try {
            agentHandle.stopFn.async((err, code) => {
                console.log(`[agent] stopped with code ${code}`);
                process.exit(0);
            });
            // timeout fallback
            setTimeout(() => process.exit(0), 3000);
        } catch {
            process.exit(0);
        }
    } else {
        process.exit(0);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── 主流程 ────────────────────────────────────────────────
function main() {
    console.log(`[agent] qltz-agent starting (log=${LOG_LEVEL})`);

    // Start agent via .so
    agentHandle = startAgent();

    // Start HTTP server (unless disabled)
    if (!WEB_DISABLE) {
        httpServer = startHttpServer();
    }

    // Keep alive
    setInterval(() => {}, 60000);
}

main();