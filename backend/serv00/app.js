// Serv00 Passenger entry
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const BACKEND_DIR = path.join(__dirname, 'xugou/backend');

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

const envFile = path.join(BACKEND_DIR, '.env');
if (fs.existsSync(envFile)) {
  log('Removing .env file');
  fs.unlinkSync(envFile);
}

log(`Backend dir: ${BACKEND_DIR}, Port: ${PORT}`);

const tsxPath = path.join(BACKEND_DIR, 'node_modules', '.bin', 'tsx');
const useNpx = !fs.existsSync(tsxPath);
const cmd = useNpx ? 'npx' : tsxPath;
const args = useNpx ? ['tsx', 'src/index.node.ts'] : ['src/index.node.ts'];

const child = spawn(cmd, args, {
  cwd: BACKEND_DIR,
  env: { ...process.env, PORT, HOSTNAME: '127.0.0.1' },
  stdio: 'inherit',
});

child.on('error', (err) => log('Spawn error: ' + err.message));
child.on('exit', (code) => log('Exited code=' + code));

setInterval(() => {}, 60000);
