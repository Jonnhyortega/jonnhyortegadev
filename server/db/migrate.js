import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { fileURLToPath } from 'node:url';

// CLI: aplica las migraciones con DATABASE_URL_MIGRATIONS (rol propietario).
// Nunca imprime la URL. Usa el WebSocket global de Node >= 22.
async function main() {
  const url = process.env.DATABASE_URL_MIGRATIONS;
  if (!url) {
    throw new Error('Falta la variable DATABASE_URL_MIGRATIONS');
  }
  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzle(pool);
    await migrate(db, {
      migrationsFolder: fileURLToPath(new URL('./migrations', import.meta.url)),
    });
    console.log('Migraciones aplicadas');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Falló la migración:', error?.message ?? 'error desconocido');
  process.exit(1);
});
