import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';
import { seedContent } from './seed.js';

export const PGLITE_MEMORY_URL = 'pglite:memory';

// True si DEV_DATABASE_URL pide la BD efímera en memoria (solo para probar el panel).
export function isPgliteMemoryUrl(url) {
  return url === PGLITE_MEMORY_URL;
}

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

// PGlite se carga bajo demanda: es devDependency y no debe pesar en producción.
// Devuelve una BD drizzle en memoria con las migraciones aplicadas y el contenido sembrado.
export async function createDevPgliteDb() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder });
  await seedContent(db);
  return db;
}
