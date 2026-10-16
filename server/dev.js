import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { createApp } from './app.js';
import { createSession, SESSION_COOKIE } from './services/sessions.js';

// Carga .env local si existe (Node >= 20.12).
try {
  process.loadEnvFile?.();
} catch {
  // sin .env: se usan las variables del entorno
}

// DEV_FAKE_SESSION=1: el panel funciona en local sin OAuth. Se trata el
// entorno como producción en este proceso y se imprime una cookie de sesión
// `full`. Nunca en Vercel ni con NODE_ENV=production.
const fakeSession = process.env.DEV_FAKE_SESSION === '1';
if (fakeSession && (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production')) {
  console.error('DEV_FAKE_SESSION no se permite con VERCEL_ENV definido ni con NODE_ENV=production.');
  process.exit(1);
}

const loadedEnv = loadEnv();
const env = fakeSession ? { ...loadedEnv, isProduction: true } : loadedEnv;
const db = createDb(env.databaseUrl);

// Stub hasta que exista el cliente real de Google (Task 9).
const google = {
  buildAuthUrl() {
    throw new Error('google client not configured');
  },
  exchangeCode() {
    throw new Error('google client not configured');
  },
  verifyIdToken() {
    throw new Error('google client not configured');
  },
};

const app = createApp({ env, db, google });

if (fakeSession) {
  const { token } = await createSession(db, {
    kind: 'full',
    ipHash: null,
    userAgent: 'dev-fake-session',
    now: new Date(),
  });
  console.log(`Sesión de desarrollo (cookie): ${SESSION_COOKIE}=${token}`);
}

const port = 3001;
app.listen(port, () => console.log(`API de desarrollo en http://localhost:${port}`));
