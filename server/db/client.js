import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema.js';

// El Pool es perezoso: no abre conexiones hasta la primera consulta.
export function createDb(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}
