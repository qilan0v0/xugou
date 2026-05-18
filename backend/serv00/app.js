// Serv00 Passenger entry - watchdog for Xugou backend
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const BACKEND_DIR = path.join(__dirname, 'xugou/backend');
const BACKEND_PORT = 7861;

let backendProcess = null;

function startBackend() {
  if (backendProcess) {
    try { backendProcess.kill(); } catch(e) {}
  }

  // Check if tsx exists
  const tsxPath = path.join(BACKEND_DIR, 'node_modules', '.bin', 'tsx');
  const useNpx = !fs.existsSync(tsxPath);

  console.log('[Watchdog] Backend dir:', BACKEND_DIR);
  console.log('[Watchdog] Using', useNpx ? 'npx tsx' : tsxPath);

  const cmd = useNpx ? 'npx' : tsxPath;
  const args = useNpx ? ['tsx', 'src/index.node.ts'] : ['src/index.node.ts'];

  backendProcess = spawn(cmd, args, {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: String(BACKEND_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProcess.stdout.on('data', (d) => process.stdout.write('[Backend] ' + d));
  backendProcess.stderr.on('data', (d) => process.stderr.write('[Backend] ' + d));

  backendProcess.on('error', (err) => {
    console.error('[Watchdog] Spawn error:', err.message);
    backendProcess = null;
  });

  backendProcess.on('exit', (code, signal) => {
    console.log('[Watchdog] Backend exited code:', code, 'signal:', signal);
    backendProcess = null;
    setTimeout(startBackend, 3000);
  });
}

// Create HTTP proxy server
const server = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: {},
  };
  // Copy headers, skip 'host'
  for (const [k, v] of Object.entries(req.headers)) {
    if (k !== 'host' && v !== undefined) options.headers[k] = v;
  }

  const proxy = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode || 502, backendRes.headers);
    backendRes.pipe(res);
  });
  proxy.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Backend starting, please retry...');
  });
  req.pipe(proxy);
});

server.listen(PORT, () => {
  console.log(`[Watchdog] Proxy on :${PORT} -> :${BACKEND_PORT}`);
  startBackend();
});
