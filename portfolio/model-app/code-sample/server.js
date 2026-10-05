import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Explicit allowlist: the server cannot expose parent folders or arbitrary files.
const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/likes.js': ['likes.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
export function createDemoServer() {
  return createServer(async (request, response) => {
    const entry = files[new URL(request.url, 'http://localhost').pathname];
    if (!entry || !['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(404); response.end('Not found'); return;
    }
    try {
      const body = await readFile(new URL(entry[0], import.meta.url));
      response.writeHead(200, { 'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(500); response.end('Unable to serve demo');
    }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createDemoServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(4173, '127.0.0.1', () => console.log('Demo: http://127.0.0.1:4173 — Ctrl+C to stop'));
}
