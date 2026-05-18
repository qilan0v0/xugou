// Serv00 watchdog - keeps Xugou backend alive
const { exec } = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 5411;
const BACKEND_DIR = path.join(__dirname, 'xugou/backend');
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
  const cmd = `cd ${BACKEND_DIR} && nohup npx tsx src/index.node.ts >> ${LOG_FILE} 2>&1 &`;
  log('Starting backend...');
  exec(cmd, (err) => {
    if (err) log('Start error: ' + err.message);
    else log('Backend spawned');
  });
}

function isBackendRunning() {
  return new Promise((resolve) => {
    exec('pgrep -f "tsx src/index.node"', (err, stdout) => {
      resolve(!!stdout.trim());
    });
  });
}

// Check & restart every 15 seconds
async function keepAlive() {
  const running = await isBackendRunning();
  if (!running) startBackend();
}
setInterval(keepAlive, 15000);

// Health check HTTP server
http.createServer(async (req, res) => {
  // Try proxy to backend
  const options = {
    hostname: '127.0.0.1', port: PORT,
    path: req.url, method: req.method,
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => k !== 'host' && k !== 'connection')
    ),
  };
  const proxy = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });
  proxy.on('error', async () => {
    const running = await isBackendRunning();
    if (!running) startBackend();
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Backend starting, retry...');
  });
  req.pipe(proxy);
}).listen(PORT + 1, () => {
  log(`Watchdog on :${PORT + 1}`);
  startBackend();
});
