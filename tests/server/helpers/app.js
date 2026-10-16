import { createApp } from '../../../server/app.js';
import { createTestDb } from './db.js';

export function createFakeGoogle() {
  let next = null;
  return {
    setNextIdentity(identity) {
      next = identity;
    },
    buildAuthUrl({ state, codeChallenge, nonce }) {
      const url = new URL('https://accounts.google.test/auth');
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('nonce', nonce);
      return url.toString();
    },
    async exchangeCode() {
      return { idToken: 'fake-id-token' };
    },
    async verifyIdToken(_idToken, { nonce } = {}) {
      if (!next) throw new Error('no identity configured');
      if (next.nonce !== undefined && next.nonce !== nonce) throw new Error('nonce mismatch');
      return { sub: next.sub, email: next.email, emailVerified: next.emailVerified };
    },
  };
}

// Construye la app con DB en memoria, reloj controlable y Google falso.
// `overrides` se fusiona en env y en las dependencias; `testRoutes` es un
// Router opcional que se monta antes del 404.
export async function buildTestApp({ env: envOverrides, testRoutes, ...depOverrides } = {}) {
  let current = new Date('2026-01-01T00:00:00.000Z');
  const clock = {
    now: () => new Date(current),
    advance(ms) {
      current = new Date(current.getTime() + ms);
    },
  };

  const env = {
    databaseUrl: 'postgres://test',
    googleClientId: 'test-client-id',
    googleClientSecret: 'test-client-secret',
    oauthRedirectUri: 'https://example.test/api/auth/google/callback',
    adminEmail: 'jonnhyortega@gmail.com',
    appOrigin: 'https://example.test',
    ipHashSecret: 'test-ip-hash-secret-0123456789abcdef',
    vercelEnv: 'production',
    isProduction: true,
    ...envOverrides,
  };
  const db = depOverrides.db ?? (await createTestDb());
  const google = depOverrides.google ?? createFakeGoogle();

  const app = createApp(
    { env, db, google, now: () => clock.now(), ...depOverrides },
    { testRoutes },
  );
  return { app, db, env, google, clock };
}
