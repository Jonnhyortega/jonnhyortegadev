import { loadEnv } from '../server/config/env.js';
import { createDb } from '../server/db/client.js';
import { createGoogleClient } from '../server/services/google.js';
import { createApp } from '../server/app.js';

const env = loadEnv();

const google = createGoogleClient(env);

export default createApp({ env, db: createDb(env.databaseUrl), google });
