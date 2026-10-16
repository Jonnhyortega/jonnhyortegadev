import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTemplateDump } from './db.js';

// Migra una sola vez para toda la corrida y comparte la plantilla con los workers
// mediante un archivo temporal (los workers heredan la variable de entorno).
export default async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'pglite-template-'));
  const file = join(dir, 'template.tar');
  const dump = await buildTemplateDump();
  await writeFile(file, Buffer.from(await dump.arrayBuffer()));
  process.env.PGLITE_TEMPLATE_FILE = file;
  return async () => {
    await rm(dir, { recursive: true, force: true });
  };
}
