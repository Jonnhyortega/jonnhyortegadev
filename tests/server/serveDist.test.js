import { describe, it, expect } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServeDistHandler } from '../../scripts/serve-dist.mjs';

const config = {
  headers: [{ source: '/(.*)', headers: [{ key: 'X-Prueba', value: '1' }] }],
};

function serve(root) {
  return http.createServer(createServeDistHandler(root, config));
}

describe('serve-dist', () => {
  it('sirve un archivo con los headers de vercel.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dist-'));
    writeFileSync(join(root, 'index.html'), '<p>hola</p>');
    const res = await request(serve(root)).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['x-prueba']).toBe('1');
    expect(res.text).toBe('<p>hola</p>');
  });

  it('una ruta con codificación inválida → 400 sin tumbar el servidor', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dist-'));
    writeFileSync(join(root, 'index.html'), 'ok');
    const server = serve(root);
    const res = await request(server).get('/%E0%A4%A');
    expect(res.status).toBe(400);
    expect((await request(server).get('/')).status).toBe(200);
  });

  it('sin el archivo ni index.html de respaldo → 404 sin tumbar el servidor', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dist-'));
    mkdirSync(join(root, 'vacio'));
    const res = await request(serve(root)).get('/no-existe.js');
    expect(res.status).toBe(404);
    // Un directorio sin index.html tampoco tumba el servidor.
    expect((await request(serve(root)).get('/vacio')).status).toBe(404);
  });
});
