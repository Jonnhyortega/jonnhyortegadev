import { loadEnv } from '../server/config/env.js';
import { createDb } from '../server/db/client.js';
import { createApp } from '../server/app.js';

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

export default createApp({ env, db: createDb(env.databaseUrl), google });
