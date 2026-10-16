// Sirve dist/ aplicando los headers de vercel.json, para verificar la CSP en un navegador real.
// Uso: npm run preview:headers  (puerto 4173)
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const port = Number(process.env.PORT) || 4173;

// Matching mínimo de `source` de Vercel: solo los patrones que usa vercel.json.
const matchers = {
  '/(.*)': () => true,
  '/((?!api/).*)': (path) => !path.startsWith('/api/'),
  '/assets/(.*)': (path) => path.startsWith('/assets/'),
};

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
};

const headersFor = (path) => {
  const out = {};
  for (const { source, headers } of config.headers ?? []) {
    const matches = matchers[source];
    if (!matches) throw new Error(`Patrón de headers sin soporte en serve-dist: ${source}`);
    if (matches(path)) for (const { key, value } of headers) out[key] = value;
  }
  return out;
};

http
  .createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(normalize(root))) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    // Fallback de SPA (solo para desarrollo local; Vercel no lo hace en producción).
    if (!existsSync(file)) file = join(root, 'index.html');
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      ...headersFor(path),
    });
    res.end(readFileSync(file));
  })
  .listen(port, () => console.log(`dist servido con headers de vercel.json en http://localhost:${port}`));
