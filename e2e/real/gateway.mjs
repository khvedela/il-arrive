// Dev-only reverse proxy for the e2e stack: `/api/*` -> API (prefix stripped, like nginx in the images), everything else -> the Angular dev server.
// usage: node gateway.mjs <listenPort> <uiPort> <apiPort>
import http from 'node:http';

const [listen, ui, api] = process.argv.slice(2).map(Number);

function forward(req, res, port, path) {
  const upstream = http.request(
    { host: '127.0.0.1', port, method: req.method, path, headers: { ...req.headers, host: `127.0.0.1:${port}` } },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/api/')) forward(req, res, api, url.slice(4));
    else forward(req, res, ui, url);
  })
  .listen(listen, '127.0.0.1', () => console.log(`gateway :${listen} -> ui :${ui}, api :${api}`));
