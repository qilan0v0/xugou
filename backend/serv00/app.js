// Serv00 watchdog - loads Xugou backend directly (no TCP listening)
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 5411;
const BACKEND_DIR = path.join(__dirname, 'xugou/backend');

// Enable TypeScript/ESM support (from backend's node_modules)
require(path.join(BACKEND_DIR, 'node_modules/tsx/cjs'));

// Use Serv00 config
const configPath = path.join(BACKEND_DIR, 'config.serv00.json');
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  process.env.JWT_SECRET = config.jwt_secret || 'change-me';
  process.env.ENABLE_DB_INIT = config.enable_db_init ? 'true' : 'false';
  process.env.DB_PATH = config.db_path || './data/xugou.db';
}

function log(msg) { console.log(`[${new Date().toLocaleString()}] ${msg}`); }

let appFetch = null;

async function loadBackend() {
  try {
    // Dynamic import ESM backend from CommonJS
    const mod = await import(path.join(BACKEND_DIR, 'src/index.node.ts'));
    // The app's fetch handler is exported via default
    appFetch = mod.default?.fetch || mod.app?.fetch;
    log('Backend loaded successfully');
  } catch(e) {
    log('Backend load error: ' + e.message);
  }
}

// HTTP server that uses backend directly
const server = http.createServer(async (req, res) => {
  if (!appFetch) {
    res.writeHead(503, { 'Content-Type': 'text/plain' });
    return res.end('Backend loading...');
  }

  // Convert Node.js req to Web Request
  const url = `http://${req.headers.host || 'localhost'}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v && k !== 'host') headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }

  const webReq = new Request(url, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined,
  });

  try {
    const webRes = await appFetch(webReq);
    res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
    if (webRes.body) {
      const reader = webRes.body.getReader();
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) { res.end(); return; }
        res.write(value); pump();
      });
      pump();
    } else {
      res.end();
    }
  } catch(e) {
    res.writeHead(500);
    res.end('Internal error');
  }
});

server.listen(PORT, () => {
  log(`Xugou backend on :${PORT}`);
  loadBackend();
});
