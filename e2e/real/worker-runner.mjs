// Runs the BullMQ worker process and exposes a readiness port so Playwright's webServer can wait for it.
import { spawn } from 'node:child_process';
import http from 'node:http';

const port = Number(process.argv[2]);
const child = spawn('node', ['apps/api/dist/worker.js'], { stdio: ['ignore', 'pipe', 'inherit'], env: process.env });
let ready = false;
child.stdout.on('data', (d) => {
  process.stdout.write(d);
  if (String(d).includes('Worker process started')) ready = true;
});
child.on('exit', (code) => process.exit(code ?? 1));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
http.createServer((_, res) => res.writeHead(ready ? 200 : 503).end()).listen(port, '127.0.0.1');
