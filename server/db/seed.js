import { count } from 'drizzle-orm';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projects, theme, translations } from './schema.js';
import {
  DEFAULT_PROJECTS,
  DEFAULT_THEME,
  DEFAULT_TRANSLATIONS,
} from '../../src/content/defaults.js';

// Inserta los valores por defecto en las tablas vacías (versión 0).
// Idempotente: no toca nada que ya exista.
export async function seedContent(db, now = new Date()) {
  await db.transaction(async (tx) => {
    await tx
      .insert(translations)
      .values({ id: 1, data: DEFAULT_TRANSLATIONS, version: 0, updatedAt: now })
      .onConflictDoNothing();
    await tx
      .insert(theme)
      .values({ id: 1, data: DEFAULT_THEME, version: 0, updatedAt: now })
      .onConflictDoNothing();

    const [{ total }] = await tx.select({ total: count() }).from(projects);
    if (total === 0) {
      await tx.insert(projects).values(
        DEFAULT_PROJECTS.map(({ id, ...project }, position) => ({
          ...project,
          slug: id,
          position,
          version: 0,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  });
}

// CLI: siembra con DATABASE_URL_MIGRATIONS (rol propietario). Nunca imprime la URL.
async function main() {
  const url = process.env.DATABASE_URL_MIGRATIONS;
  if (!url) {
    throw new Error('Falta la variable DATABASE_URL_MIGRATIONS');
  }
  const { Pool, neonConfig } = await import('@neondatabase/serverless');
  // En Node < 22 no hay WebSocket global: se usa `ws` (solo en este CLI).
  if (globalThis.WebSocket === undefined) {
    neonConfig.webSocketConstructor = (await import('ws')).default;
  }
  const { drizzle } = await import('drizzle-orm/neon-serverless');
  const pool = new Pool({ connectionString: url });
  try {
    await seedContent(drizzle(pool));
    console.log('Contenido inicial sembrado');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Falló el seed:', error?.message ?? 'error desconocido');
    process.exit(1);
  });
}
