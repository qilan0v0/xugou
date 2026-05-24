// Serv00 Passenger entry — starts the backend watchdog
// Passenger auto-detects this file and keeps it alive
// Place this at: ~/domains/你的用户名.serv00.net/public_nodejs/app.js

const { spawn } = require("child_process");
const path = require("path");

const BACKEND_DIR = path.join(__dirname, "xugou", "backend");
const WATCHDOG = path.join(BACKEND_DIR, "serv00", "app.cjs");

console.log("[Passenger] Starting Xugou watchdog...");

const child = spawn("node", [WATCHDOG], {
  cwd: BACKEND_DIR,
  env: { ...process.env, MAX_MEMORY_MB: "128", RESTART_MINUTES: "40" },
  stdio: "inherit",
});

child.on("exit", (code) => {
  console.log("[Passenger] Watchdog exited (code " + code + "), restarting...");
  process.exit(1); // Passenger will restart on exit
});

child.on("error", (err) => {
  console.error("[Passenger] Failed:", err.message);
  process.exit(1);
});

// Keep process alive, let watchdog handle the rest
process.on("SIGTERM", () => {
  child.kill("SIGTERM");
  process.exit(0);
});
