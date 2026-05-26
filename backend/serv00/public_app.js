// Qltz Passenger entry — self-contained watchdog with HTTP proxy
// Copy to: ~/domains/用户名.serv00.net/public_nodejs/app.js
// Passenger detects the HTTP server and auto-starts on first request

const { spawn } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");
const fs = require("fs");

const BACKEND_DIR = path.join(__dirname, "qltz", "backend");
const PORT = parseInt(process.env.PORT) || 5411;
const LOG_FILE = path.join(BACKEND_DIR, "data", "backend.log");
const MAX_MEMORY_MB = 128;

function log(msg) { console.log(`[Passenger ${new Date().toISOString()}] ${msg}`); }

// Copy serv00 config
const configSrc = path.join(BACKEND_DIR, "config.serv00.json");
if (fs.existsSync(configSrc)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configSrc, "utf-8"));
    fs.writeFileSync(path.join(BACKEND_DIR, "config.json"),
      JSON.stringify({ ...cfg, port: PORT, hostname: "0.0.0.0" }, null, 2));
  } catch {}
}

let backendProcess = null;
let starting = false;

function startBackend() {
  if (starting) return;
  starting = true;
  if (backendProcess) { try { backendProcess.kill("SIGKILL"); } catch {} }

  const distFile = path.join(BACKEND_DIR, "dist", "index.node.js");
  if (!fs.existsSync(distFile)) {
    log("dist/index.node.js missing, run: cd " + BACKEND_DIR + " && npm run build:node");
    starting = false;
    return;
  }

  backendProcess = spawn("node", [
    "--max-old-space-size=" + MAX_MEMORY_MB,
    "--expose-gc",
    distFile,
  ], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "production" },
    stdio: ["ignore", fs.openSync(LOG_FILE, "a"), fs.openSync(LOG_FILE, "a")],
  });

  backendProcess.on("exit", (code) => {
    log("Backend exited (code " + code + ")");
    backendProcess = null;
  });
  backendProcess.on("error", (err) => {
    log("Backend error: " + err.message);
    backendProcess = null;
  });

  log("Backend started (max " + MAX_MEMORY_MB + "MB heap)");
  setTimeout(() => { starting = false; }, 3000);
}

function portAlive() {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => { s.destroy(); resolve(false); });
    s.on("timeout", () => { s.destroy(); resolve(false); });
    s.connect(PORT, "127.0.0.1");
  });
}

// HTTP proxy — Passenger detects this and routes requests here
const server = http.createServer(async (req, res) => {
  try {
    const options = {
      hostname: "127.0.0.1", port: PORT,
      path: req.url, method: req.method,
      headers: Object.fromEntries(
        Object.entries(req.headers).filter(([k]) => k !== "host")
      ),
    };
    const proxy = http.request(options, (backendRes) => {
      res.writeHead(backendRes.statusCode, backendRes.headers);
      backendRes.pipe(res);
    });
    proxy.setTimeout(5000, () => { proxy.destroy(); });
    proxy.on("error", async () => {
      if (!backendProcess && !starting) startBackend();
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Backend starting, retry...");
    });
    req.pipe(proxy);
  } catch (e) {
    res.writeHead(500);
    res.end("Internal error");
  }
});

server.listen(PORT + 1, "0.0.0.0", () => {
  log("Watchdog HTTP on :" + (PORT + 1));
  startBackend();
});

// Keep-alive check every 30s
setInterval(async () => {
  if (!(await portAlive()) && !starting) startBackend();
}, 30000);

// Scheduled restart every 40 min
setInterval(() => {
  if (backendProcess) {
    log("Scheduled restart...");
    try { backendProcess.kill("SIGTERM"); } catch {}
    backendProcess = null;
    // keepAlive will restart within 30s
  }
}, 40 * 60 * 1000);
