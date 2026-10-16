import { loadEnv } from './config/env.js';
import { createDb } from './db/client.js';
import { createApp } from './app.js';

// Carga .env local si existe (Node >= 20.12).
try {
  process.loadEnvFile?.();
} catch {
  // sin .env: se usan las variables del entorno
}

const env = loadEnv();

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

const app = createApp({ env, db: createDb(env.databaseUrl), google });
const port = 3001;
app.listen(port, () => console.log(`API de desarrollo en http://localhost:${port}`));
