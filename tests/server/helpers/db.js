import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import * as schema from '../../../server/db/schema.js';

const migrationsFolder = fileURLToPath(
  new URL('../../../server/db/migrations', import.meta.url),
);

// Base de datos PGlite en memoria con las migraciones aplicadas.
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db;
}
