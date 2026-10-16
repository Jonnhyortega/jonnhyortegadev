// Arranca la API de desarrollo lista para probar el panel: sesión falsa `full`
// y BD PGlite en memoria. Los valores de entorno son de relleno (nada real).
// Uso: npm run dev:panel  (y en otra terminal: npm run dev)
const dummy = {
  GOOGLE_CLIENT_ID: 'dev-client-id',
  GOOGLE_CLIENT_SECRET: 'dev-client-secret',
  OAUTH_REDIRECT_URI: 'http://localhost:3001/api/auth/google/callback',
  ADMIN_EMAIL: 'dev@example.com',
  APP_ORIGIN: 'http://localhost:5173',
  IP_HASH_SECRET: 'dev-ip-hash-secret-0123456789abcdef',
  PANEL_RETURN_SECRET: 'dev-panel-return-secret-0123456789abcdef',
};
for (const [key, value] of Object.entries(dummy)) process.env[key] ??= value;

// Nunca se toca una BD real: DATABASE_URL queda como relleno y la BD es la de memoria.
process.env.DATABASE_URL = 'postgres://dev:dev@localhost:5432/dev-placeholder';
process.env.DEV_FAKE_SESSION = '1';
process.env.DEV_DATABASE_URL = 'pglite:memory';

await import('../server/dev.js');
