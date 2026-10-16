import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as schema from '../../../server/db/schema.js';

const migrationsFolder = fileURLToPath(
  new URL('../../../server/db/migrations', import.meta.url),
);

// Volcado de una base migrada, usado como plantilla de cada instancia.
export async function buildTemplateDump() {
  const seed = new PGlite();
  await migrate(drizzle(seed, { schema }), { migrationsFolder });
  const dump = await seed.dumpDataDir('none');
  await seed.close();
  return dump;
}

// La plantilla la deja lista globalSetup (una sola migración para toda la corrida);
// si falta (p. ej. al ejecutar el archivo fuera de vitest) se construye en el worker.
let templatePromise;

function getTemplate() {
  templatePromise ??= process.env.PGLITE_TEMPLATE_FILE
    ? readFile(process.env.PGLITE_TEMPLATE_FILE).then((buf) => new Blob([buf]))
    : buildTemplateDump();
  return templatePromise;
}

// Pool acotado de instancias: cada PGlite retiene cientos de MB de memoria WASM que
// close() no libera, y los tests no las cierran. Se crean como mucho MAX_LIVE por worker
// (copias independientes de la plantilla) y se reutilizan en rotación, vaciando sus
// tablas al entregarlas, de modo que cada test recibe una base vacía y sin estado previo.
// Un mismo test no puede pedir más de MAX_LIVE bases (si no, reciclaría una en uso);
// el contador se reinicia antes de cada test con resetTestDbPool (ver setupFiles).
export const MAX_LIVE = 3;
const pool = [];
let next = 0;
let requestedInTest = 0;

export function resetTestDbPool() {
  requestedInTest = 0;
}

// Huella del esquema (tablas y restricciones de public). Algunos tests rompen el
// esquema a propósito (drop table, constraints extra) para simular fallos de BD:
// una instancia con otra huella no se recicla, se reemplaza por una copia limpia.
async function schemaFingerprint(client) {
  const { rows } = await client.query(
    `SELECT (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')::int AS tables,
            (SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
              WHERE n.nspname = 'public')::int AS constraints`,
  );
  return `${rows[0].tables}/${rows[0].constraints}`;
}
let cleanFingerprint;

async function freshClient() {
  const template = await getTemplate();
  const client = new PGlite({ loadDataDir: template });
  await client.waitReady;
  cleanFingerprint ??= await schemaFingerprint(client);
  return client;
}

async function resetTables(client) {
  // Defensa: suelta bloqueos y transacciones que un test anterior haya dejado abiertos.
  await client.query('SELECT pg_advisory_unlock_all()');
  await client.exec('ROLLBACK').catch(() => {});
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
  );
  if (rows.length === 0) return;
  const names = rows.map((r) => `"${r.tablename}"`).join(', ');
  await client.exec(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
}

// Base de datos PGlite en memoria con las migraciones aplicadas y todas las tablas vacías.
export async function createTestDb() {
  if (requestedInTest >= MAX_LIVE) {
    throw new Error(
      `más de ${MAX_LIVE} bases de test en un mismo test: subí MAX_LIVE en tests/server/helpers/db.js`,
    );
  }
  requestedInTest += 1;
  let client;
  if (pool.length < MAX_LIVE) {
    client = await freshClient();
    pool.push(client);
  } else {
    const slot = next++ % MAX_LIVE;
    client = pool[slot];
    await resetTables(client);
    if ((await schemaFingerprint(client)) !== cleanFingerprint) {
      await client.close().catch(() => {});
      client = await freshClient();
      pool[slot] = client;
    }
  }
  return drizzle(client, { schema });
}
