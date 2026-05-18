// Serv00 Passenger entry - starts Xugou backend directly
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const BACKEND_DIR = path.join(__dirname, 'xugou/backend');

// Check if tsx exists
const tsxPath = path.join(BACKEND_DIR, 'node_modules', '.bin', 'tsx');
const useNpx = !fs.existsSync(tsxPath);

console.log('[Watchdog] Backend dir:', BACKEND_DIR);
console.log('[Watchdog] Port:', PORT);

const cmd = useNpx ? 'npx' : tsxPath;
const args = useNpx ? ['tsx', 'src/index.node.ts'] : ['src/index.node.ts'];

const child = spawn(cmd, args, {
  cwd: BACKEND_DIR,
  env: { ...process.env, PORT },
  stdio: 'inherit',
});

child.on('error', (err) => {
  console.error('[Watchdog] Spawn error:', err.message);
});

child.on('exit', (code) => {
  console.log('[Watchdog] Backend exited code:', code, '- Passenger will restart if needed');
});

// Keep process alive for Passenger
setInterval(() => {}, 60000);
