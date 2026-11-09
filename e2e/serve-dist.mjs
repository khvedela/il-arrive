// Minimal SPA static server for the production build (service worker needs a real build).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('../apps/web/dist/web/browser/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  let body;
  try { body = await readFile(file); } catch { file = join(root, 'index.html'); body = await readFile(file); }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(body);
}).listen(4300);
