import { createReadStream } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.resolve(ROOT, process.argv[2] || '_site');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 4173;
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'], ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.gif', 'image/gif'], ['.mp4', 'video/mp4'], ['.webm', 'video/webm'],
]);

async function exists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

const manifest = JSON.parse(await readFile(path.join(OUTPUT, 'asset-manifest.json'), 'utf8'));
const basePath = manifest.basePath === '/' ? '' : manifest.basePath;

function safePathname(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${HOST}:${PORT}`).pathname);
  if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return null;
  const stripped = basePath ? pathname.slice(basePath.length) || '/' : pathname;
  const target = path.resolve(OUTPUT, `.${stripped}`);
  const relative = path.relative(OUTPUT, target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : target;
}

async function responseFile(requestUrl) {
  const requested = safePathname(requestUrl);
  if (!requested) return null;
  if (await exists(requested) && (await stat(requested)).isFile()) return requested;
  const index = path.join(requested, 'index.html');
  return await exists(index) ? index : null;
}

const server = createServer(async (request, response) => {
  try {
    const file = await responseFile(request.url || '/');
    const target = file || path.join(OUTPUT, '404.html');
    const extension = path.extname(target).toLowerCase();
    response.statusCode = file ? 200 : 404;
    response.setHeader('Content-Type', MIME.get(extension) || 'application/octet-stream');
    response.setHeader('Cache-Control', target.includes(`${path.sep}hashed-assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (request.method === 'HEAD') return response.end();
    createReadStream(target).pipe(response);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end(`Preview error: ${error.message}\n`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`QuartzLab preview: http://${HOST}:${PORT}${basePath || '/'} (serving ${OUTPUT})`);
});
