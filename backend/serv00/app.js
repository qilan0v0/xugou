// Serv00 watchdog - keeps Xugou backend alive
const { exec } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 5411;
const BACKEND_DIR = path.join(__dirname, '..');
const LOG_FILE = path.join(BACKEND_DIR, 'data/backend.log');

// Use Serv00 config
const configPath = path.join(BACKEND_DIR, 'config.serv00.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  // Copy to backend's config.json
  fs.writeFileSync(path.join(BACKEND_DIR, 'config.json'), JSON.stringify({...config, port: PORT, hostname: '0.0.0.0'}, null, 2));
}

function log(msg) { console.log(`[${new Date().toLocaleString()}] ${msg}`); }

function startBackend() {
  // Kill any old backend processes first
  exec('pkill -9 -f "tsx.*index.node" 2>/dev/null; pkill -9 -f "node.*index.node" 2>/dev/null; sleep 1', () => {
    const cmd = `cd ${BACKEND_DIR} && nohup npx tsx src/index.node.ts >> ${LOG_FILE} 2>&1 &`;
    log('Starting backend...');
    exec(cmd, (err) => {
      if (err) log('Start error: ' + err.message);
      else log('Backend spawned');
    });
  });
}

function killTsx() {
  exec('pkill -f "tsx src/index.node" 2>/dev/null; pkill -f "node.*index.node" 2>/dev/null');
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

// Check & restart every 15 seconds
async function keepAlive() {
  const portBusy = await portInUse();
  if (!portBusy) startBackend();
}
setInterval(keepAlive, 15000);

// Health check HTTP server
const server = http.createServer(async (req, res) => {
  // Let WebSocket upgrades be handled by the 'upgrade' event
  if ((req.headers.upgrade || '').toLowerCase() === 'websocket') return;

  // Try proxy to backend
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

// WebSocket upgrade proxy — raw TCP bridging preserves all headers
server.on('upgrade', (req, clientSocket, head) => {
  log('WS upgrade: ' + req.url);

  const backendSocket = net.connect(PORT, '127.0.0.1', () => {
    // Forward the raw HTTP upgrade request
    const headers = [`Host: 127.0.0.1:${PORT}`];
    for (const [k, v] of Object.entries(req.headers)) {
      if (k.toLowerCase() !== 'host') headers.push(`${k}: ${v}`);
    }

    backendSocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      headers.join('\r\n') + '\r\n\r\n'
    );

    if (head.length > 0) backendSocket.write(head);

    // Bidirectional pipe
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
