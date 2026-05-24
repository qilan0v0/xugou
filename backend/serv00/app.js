// Serv00 watchdog — keeps Xugou backend alive with memory limits
const { exec, spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 5411;
const RESTART_MINUTES = parseInt(process.env.RESTART_MINUTES) || 40;
const BACKEND_DIR = path.join(__dirname, '..');
const LOG_FILE = path.join(BACKEND_DIR, 'data', 'backend.log');
const MAX_MEMORY_MB = 128;

// Copy serv00 config to backend config.json
const configPath = path.join(BACKEND_DIR, 'config.serv00.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  fs.writeFileSync(path.join(BACKEND_DIR, 'config.json'), JSON.stringify({...config, port: PORT, hostname: '0.0.0.0'}, null, 2));
}

function log(msg) { console.log(`[${new Date().toLocaleString()}] ${msg}`); }

let backendProcess = null;

function startBackend() {
  // Kill any old processes first
  exec('pkill -9 -f "tsx.*index.node" 2>/dev/null; pkill -9 -f "node.*dist/index.node" 2>/dev/null; sleep 1', () => {
    // Build TypeScript first (skip if dist already exists and src hasn't changed)
    const distFile = path.join(BACKEND_DIR, 'dist', 'index.node.js');
    const shouldBuild = !fs.existsSync(distFile) || needsRebuild();

    function launch() {
      const nodeBin = 'node';
      const args = [
        `--max-old-space-size=${MAX_MEMORY_MB}`,
        '--expose-gc',
        path.join('dist', 'index.node.js')
      ];
      const opts = {
        cwd: BACKEND_DIR,
        env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
        stdio: ['ignore', fs.openSync(LOG_FILE, 'a'), fs.openSync(LOG_FILE, 'a')]
      };

      log(`Starting backend (max ${MAX_MEMORY_MB}MB heap)...`);
      backendProcess = spawn(nodeBin, args, opts);
      backendProcess.on('exit', (code) => {
        log(`Backend exited (code ${code}), will restart on next check`);
        backendProcess = null;
      });
      backendProcess.on('error', (err) => {
        log('Backend spawn error: ' + err.message);
        backendProcess = null;
      });
    }

    if (shouldBuild) {
      log('Building TypeScript...');
      exec(`cd ${BACKEND_DIR} && npx tsc -p tsconfig.node.json && echo '{"type":"commonjs"}' > dist/package.json`, (err) => {
        if (err) {
          log('Build failed: ' + err.message);
        } else {
          log('Build OK');
        }
        launch();
      });
    } else {
      launch();
    }
  });
}

function needsRebuild() {
  try {
    const distStat = fs.statSync(path.join(BACKEND_DIR, 'dist', 'index.node.js'));
    const distTime = distStat.mtimeMs;
    // Check if any .ts file is newer than dist
    function checkDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const fp = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (checkDir(fp)) return true;
        } else if (e.name.endsWith('.ts') && fs.statSync(fp).mtimeMs > distTime) {
          return true;
        }
      }
      return false;
    }
    return checkDir(path.join(BACKEND_DIR, 'src'));
  } catch { return true; }
}

function portInUse() {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(2000);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.connect(PORT, '127.0.0.1');
  });
}

// Check & restart every 30 seconds (less aggressive)
async function keepAlive() {
  const portBusy = await portInUse();
  if (!portBusy) startBackend();
}
setInterval(keepAlive, 30000);

// Scheduled restart — release accumulated memory every N minutes
function scheduledRestart() {
  if (!backendProcess) {
    log('Scheduled restart skipped (no backend running)');
    return;
  }
  log(`Scheduled restart (every ${RESTART_MINUTES}min) — killing backend...`);
  try { backendProcess.kill('SIGTERM'); } catch {}
  // Give it 3 seconds to exit gracefully, then force kill
  setTimeout(() => {
    if (backendProcess) {
      try { backendProcess.kill('SIGKILL'); } catch {}
      backendProcess = null;
    }
    exec('pkill -9 -f "node.*dist/index.node" 2>/dev/null; sleep 1', () => {
      log('Restarting after scheduled kill...');
      startBackend();
    });
  }, 3000);
}
setInterval(scheduledRestart, RESTART_MINUTES * 60 * 1000);

// Health check HTTP server
const server = http.createServer(async (req, res) => {
  if ((req.headers.upgrade || '').toLowerCase() === 'websocket') return;

  const options = {
    hostname: '127.0.0.1', port: PORT,
    path: req.url, method: req.method,
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => k !== 'host')
    ),
  };
  const proxy = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });
  proxy.on('error', async () => {
    const portBusy = await portInUse();
    if (!portBusy) startBackend();
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Backend starting, retry...');
  });
  req.pipe(proxy);
});

// WebSocket upgrade proxy
server.on('upgrade', (req, clientSocket, head) => {
  log('WS upgrade: ' + req.url);

  const backendSocket = net.connect(PORT, '127.0.0.1', () => {
    const headers = [`Host: 127.0.0.1:${PORT}`];
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase() !== 'host') headers.push(`${k}: ${v}`);
    }

    backendSocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      headers.join('\r\n') + '\r\n\r\n'
    );

    if (head.length > 0) backendSocket.write(head);

    backendSocket.pipe(clientSocket);
    clientSocket.pipe(backendSocket);
  });

  backendSocket.on('error', (err) => {
    log('Backend WS error: ' + err.message);
    clientSocket.end();
  });
  clientSocket.on('error', (err) => {
    log('Client WS error: ' + err.message);
    backendSocket.end();
  });
});

server.listen(PORT + 1, () => {
  log(`Watchdog on :${PORT + 1}`);
  startBackend();
});
