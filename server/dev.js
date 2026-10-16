import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { createGoogleClient } from './services/google.js';
import { createApp } from './app.js';
import { createSession, SESSION_COOKIE } from './services/sessions.js';
import { assertDevFakeSessionAllowed } from './config/devSession.js';
import { createDevPgliteDb, isPgliteMemoryUrl } from './db/devPglite.js';

// Carga .env local si existe (Node >= 20.12).
try {
  process.loadEnvFile?.();
} catch {
  // sin .env: se usan las variables del entorno
}

// DEV_FAKE_SESSION=1: el panel funciona en local sin OAuth. Se trata el
// entorno como producción en este proceso y se imprime una cookie de sesión
// `full` de 2 h, creada SOLO en DEV_DATABASE_URL (nunca en DATABASE_URL).
const fakeSession = process.env.DEV_FAKE_SESSION === '1';
let devDatabaseUrl = null;
if (fakeSession) {
  try {
    devDatabaseUrl = assertDevFakeSessionAllowed(process.env);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

const loadedEnv = loadEnv();
const env = fakeSession
  ? { ...loadedEnv, databaseUrl: devDatabaseUrl, isProduction: true }
  : loadedEnv;
// DEV_DATABASE_URL=pglite:memory usa una BD efímera en memoria (migrada y sembrada).
const db =
  fakeSession && isPgliteMemoryUrl(devDatabaseUrl)
    ? await createDevPgliteDb()
    : createDb(env.databaseUrl);

const google = createGoogleClient(env);

const app = createApp({ env, db, google });

if (fakeSession) {
  const { token } = await createSession(db, {
    kind: 'full',
    ipHash: null,
    userAgent: 'dev-fake-session',
    now: new Date(),
    lifetimeMs: 2 * 60 * 60 * 1000,
  });
  console.log(
    'Sesión de desarrollo en DEV_DATABASE_URL: dura 2 h y caduca tras 30 min sin actividad.',
  );
  console.log(`Cookie: ${SESSION_COOKIE}=${token}`);
}

const port = 3001;
app.listen(port, () => console.log(`API de desarrollo en http://localhost:${port}`));
