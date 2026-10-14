// Dev helper: runs the API server and Vite together.
import { spawn } from 'node:child_process';

const procs = [];
function run(cmd, args, color) {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  procs.push(p);
}
function killAll() {
  for (const p of procs) try { p.kill('SIGTERM'); } catch {}
  process.exit(0);
}
process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);

run('node', ['server/index.js']);
run('npx', ['vite', '--host']);
