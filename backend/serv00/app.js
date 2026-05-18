// Serv00 Passenger entry - watchdog for Xugou backend
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BACKEND_DIR = path.join(__dirname, '..');
const BACKEND_PORT = 7861;

let backendProcess = null;

function startBackend() {
  if (backendProcess) {
    try { backendProcess.kill(); } catch(e) {}
  }

  console.log('[Watchdog] Starting backend...');
  backendProcess = spawn('npx', ['tsx', 'src/index.node.ts'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: String(BACKEND_PORT) },
    stdio: 'pipe',
    shell: true,
  });

  backendProcess.stdout.on('data', (d) => process.stdout.write('[Backend] ' + d));
  backendProcess.stderr.on('data', (d) => process.stderr.write('[Backend] ' + d));
  backendProcess.on('exit', (code) => {
    console.log('[Watchdog] Backend exited with code', code);
    backendProcess = null;
    // Restart after 2 seconds
    setTimeout(startBackend, 2000);
  });
}

// Create simple HTTP server that Passenger can monitor
const server = http.createServer((req, res) => {
  // Proxy to backend
  const options = {
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: undefined },
  };
  const proxy = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(502);
    res.end('Backend not ready');
  });
  req.pipe(proxy);
});

server.listen(PORT, () => {
  console.log(`[Watchdog] Proxy on port ${PORT} -> backend port ${BACKEND_PORT}`);
  startBackend();
});
