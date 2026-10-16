// Sirve dist/ aplicando los headers de vercel.json, para verificar la CSP en un navegador real.
// Uso: npm run preview:headers  (puerto 4173)
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const headersFor = (config, path) => {
  const out = {};
  for (const { source, headers } of config.headers ?? []) {
    const matches = matchers[source];
    if (!matches) throw new Error(`Patrón de headers sin soporte en serve-dist: ${source}`);
    if (matches(path)) for (const { key, value } of headers) out[key] = value;
  }
  return out;
};

const isFile = (file) => existsSync(file) && statSync(file).isFile();

// Handler HTTP que sirve `root`. Una ruta mal codificada responde 400 y un archivo
// inexistente o ilegible 404, en vez de tumbar el proceso.
export function createServeDistHandler(root, config) {
  return (req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    try {
      let file = normalize(join(root, path));
      if (!file.startsWith(normalize(root))) {
        res.writeHead(403).end();
        return;
      }
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      // Fallback de SPA (solo para desarrollo local; Vercel no lo hace en producción).
      if (!isFile(file)) file = join(root, 'index.html');
      const body = readFileSync(file);
      res.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        ...headersFor(config, path),
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const port = Number(process.env.PORT) || 4173;
  http
    .createServer(createServeDistHandler(root, config))
    .listen(port, () => console.log(`dist servido con headers de vercel.json en http://localhost:${port}`));
}
