// Serv00 stable watchdog - keeps Xugou backend alive
// Inspired by: https://www.nodeseek.com/post-294529-1
const { exec } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = process.env.PORT || 5411;
const USER = process.env.USER || require('os').userInfo().username;
const BACKEND_PORT = 7860;
const BACKEND_DIR = path.join(__dirname, 'xugou/backend');

function log(msg) { console.log(`[${new Date().toLocaleString()}] ${msg}`); }

// Check and restart backend every 10 seconds
function keepAlive() {
  const cmd = `pgrep -f "tsx src/index.node"`;
  exec(cmd, (err, stdout) => {
    if (stdout.trim()) {
      // Process is running, do nothing
    } else {
      log('Backend not running, starting...');
      const startCmd = `cd ${BACKEND_DIR} && nohup npx tsx src/index.node > data/backend.log 2>&1 &`;
      exec(startCmd, (err) => {
        if (err) log('Start error: ' + err.message);
        else log('Backend started');
      });
    }
  });
}

setInterval(keepAlive, 10 * 1000);

// Simple HTTP server for Passenger & health check
http.createServer((req, res) => {
  // Proxy to backend
  const options = {
    hostname: '127.0.0.1', port: BACKEND_PORT,
    path: req.url, method: req.method,
    headers: Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => k !== 'host')
    ),
  };
  const proxy = http.request(options, (backendRes) => {
    res.writeHead(backendRes.statusCode, backendRes.headers);
    backendRes.pipe(res);
  });
  proxy.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Backend starting, retry...');
  });
  req.pipe(proxy);
}).listen(PORT, () => {
  log(`Watchdog on :${PORT}, proxy to :${BACKEND_PORT}`);
  keepAlive();
});
