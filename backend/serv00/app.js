// Serv00 Passenger entry
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const BACKEND_DIR = path.join(__dirname, 'xugou/backend');
const LOG = fs.createWriteStream(path.join(BACKEND_DIR, 'data/backend.log'), { flags: 'a' });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  LOG.write(line + '\n');
}

// Delete .env if exists to prevent port override
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

log(`Command: ${cmd} ${args.join(' ')}`);

const child = spawn(cmd, args, {
  cwd: BACKEND_DIR,
  env: { ...process.env, PORT },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (d) => {
  process.stdout.write(d);
  LOG.write(d);
});

child.stderr.on('data', (d) => {
  process.stderr.write(d);
  LOG.write('ERR: ' + d);
});

child.on('error', (err) => {
  log('Spawn error: ' + err.message);
});

child.on('exit', (code, signal) => {
  log(`Backend exited code=${code} signal=${signal}`);
});

setInterval(() => {}, 60000);
