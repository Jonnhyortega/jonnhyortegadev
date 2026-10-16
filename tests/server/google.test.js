import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'node:crypto';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createGoogleClient } from '../../server/services/google.js';
import { createFlow, takeFlow } from '../../server/services/oauthFlows.js';
import { oauthFlows } from '../../server/db/schema.js';
import { sha256 } from '../../server/lib/crypto.js';
import { createTestDb } from './helpers/db.js';

const MIN = 60_000;

const env = {
  googleClientId: 'test-client-id',
  googleClientSecret: 'test-client-secret',
  oauthRedirectUri: 'https://example.test/api/auth/google/callback',
};

describe('createGoogleClient().buildAuthUrl', () => {
  it('arma la URL de autorización con PKCE S256 y todos los parámetros', () => {
    const client = createGoogleClient(env, { jwks: () => {}, fetch: () => {} });
    const url = new URL(
      client.buildAuthUrl({ state: 'st', codeChallenge: 'cc', nonce: 'nn' }),
    );
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'test-client-id',
      redirect_uri: 'https://example.test/api/auth/google/callback',
      response_type: 'code',
      scope: 'openid email',
      state: 'st',
      nonce: 'nn',
      code_challenge: 'cc',
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  });
});

describe('createGoogleClient().exchangeCode', () => {
  it('hace POST form-encoded al endpoint de token y devuelve el id_token', async () => {
    const calls = [];
    const fakeFetch = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id_token: 'the-id-token', access_token: 'x' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = createGoogleClient(env, { jwks: () => {}, fetch: fakeFetch });

    await expect(client.exchangeCode({ code: 'the-code', codeVerifier: 'the-verifier' })).resolves.toEqual({
      idToken: 'the-id-token',
    });

    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    expect(String(url)).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('content-type')).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      code: 'the-code',
      code_verifier: 'the-verifier',
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      redirect_uri: 'https://example.test/api/auth/google/callback',
      grant_type: 'authorization_code',
    });
  });

  it('rechaza ante un status no 2xx sin filtrar el cuerpo de la respuesta', async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'SECRETO-DE-GOOGLE' }), {
        status: 400,
      });
    const client = createGoogleClient(env, { jwks: () => {}, fetch: fakeFetch });
    const err = await client
      .exchangeCode({ code: 'CODIGO-UNICO', codeVerifier: 'VERIFIER-UNICO' })
      .then(() => null, (e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toMatch(/invalid_grant|SECRETO|CODIGO-UNICO|VERIFIER-UNICO/);
  });

  it('rechaza si la respuesta no trae id_token', async () => {
    const fakeFetch = async () => new Response(JSON.stringify({ access_token: 'x' }), { status: 200 });
    const client = createGoogleClient(env, { jwks: () => {}, fetch: fakeFetch });
    await expect(client.exchangeCode({ code: 'c', codeVerifier: 'v' })).rejects.toThrow();
  });
});

describe('createGoogleClient().verifyIdToken', () => {
  let privateKey;
  let otherPrivateKey;
  let client;

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    otherPrivateKey = (await generateKeyPair('RS256')).privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
    client = createGoogleClient(env, { jwks: createLocalJWKSet({ keys: [jwk] }), fetch: () => {} });
  });

  const basePayload = {
    sub: '1234567890',
    email: 'jonnhyortega@gmail.com',
    email_verified: true,
    nonce: 'flow-nonce',
  };

  function sign(payload = {}, { issuer = 'https://accounts.google.com', audience = 'test-client-id', key, expiresIn = '5m' } = {}) {
    return new SignJWT({ ...basePayload, ...payload })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(key ?? privateKey);
  }

  it('token válido → { sub, email, emailVerified }', async () => {
    await expect(client.verifyIdToken(await sign(), { nonce: 'flow-nonce' })).resolves.toEqual({
      sub: '1234567890',
      email: 'jonnhyortega@gmail.com',
      emailVerified: true,
    });
  });

  it('acepta el issuer sin esquema', async () => {
    const token = await sign({}, { issuer: 'accounts.google.com' });
    await expect(client.verifyIdToken(token, { nonce: 'flow-nonce' })).resolves.toMatchObject({
      sub: '1234567890',
    });
  });

  it('email_verified "true" (string) → true; "false" o ausente → false', async () => {
    const asString = await client.verifyIdToken(await sign({ email_verified: 'true' }), { nonce: 'flow-nonce' });
    expect(asString.emailVerified).toBe(true);
    const falseString = await client.verifyIdToken(await sign({ email_verified: 'false' }), { nonce: 'flow-nonce' });
    expect(falseString.emailVerified).toBe(false);
    const missing = await client.verifyIdToken(await sign({ email_verified: undefined }), { nonce: 'flow-nonce' });
    expect(missing.emailVerified).toBe(false);
    const truthy = await client.verifyIdToken(await sign({ email_verified: 1 }), { nonce: 'flow-nonce' });
    expect(truthy.emailVerified).toBe(false);
  });

  it('nonce distinto o ausente → rechaza', async () => {
    await expect(client.verifyIdToken(await sign(), { nonce: 'otro' })).rejects.toThrow();
    await expect(client.verifyIdToken(await sign({ nonce: undefined }), { nonce: 'flow-nonce' })).rejects.toThrow();
    await expect(client.verifyIdToken(await sign(), {})).rejects.toThrow();
  });

  it('audience o issuer incorrectos → rechaza', async () => {
    await expect(
      client.verifyIdToken(await sign({}, { audience: 'otro-cliente' }), { nonce: 'flow-nonce' }),
    ).rejects.toThrow();
    await expect(
      client.verifyIdToken(await sign({}, { issuer: 'https://evil.example' }), { nonce: 'flow-nonce' }),
    ).rejects.toThrow();
  });

  it('firma con otra clave o token expirado → rechaza', async () => {
    await expect(
      client.verifyIdToken(await sign({}, { key: otherPrivateKey }), { nonce: 'flow-nonce' }),
    ).rejects.toThrow();
    const expired = await new SignJWT(basePayload)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://accounts.google.com')
      .setAudience('test-client-id')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey);
    await expect(client.verifyIdToken(expired, { nonce: 'flow-nonce' })).rejects.toThrow();
  });

  it('sin email string o sin sub → rechaza', async () => {
    await expect(client.verifyIdToken(await sign({ email: undefined }), { nonce: 'flow-nonce' })).rejects.toThrow();
    await expect(client.verifyIdToken(await sign({ email: 42 }), { nonce: 'flow-nonce' })).rejects.toThrow();
    await expect(client.verifyIdToken(await sign({ sub: undefined }), { nonce: 'flow-nonce' })).rejects.toThrow();
  });

  it('alg distinto de RS256 (HS256) → rechaza', async () => {
    const hs = await new SignJWT(basePayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience('test-client-id')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('0123456789abcdef0123456789abcdef'));
    await expect(client.verifyIdToken(hs, { nonce: 'flow-nonce' })).rejects.toThrow();
  });
});

describe('oauthFlows', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('createFlow guarda solo el hash del state y devuelve un challenge S256 base64url', async () => {
    const db = await createTestDb();
    const flow = await createFlow(db, now);
    expect(flow.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(flow.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(flow.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(flow.codeChallenge).toBe(createHash('sha256').update(flow.codeVerifier).digest('base64url'));

    const rows = await db.select().from(oauthFlows);
    expect(rows).toHaveLength(1);
    expect(rows[0].stateHash).toBe(sha256(flow.state));
    expect(rows[0].expiresAt.getTime()).toBe(now.getTime() + 5 * MIN);
  });

  it('takeFlow devuelve el flujo una sola vez', async () => {
    const db = await createTestDb();
    const flow = await createFlow(db, now);
    await expect(takeFlow(db, { state: flow.state, now })).resolves.toEqual({
      codeVerifier: flow.codeVerifier,
      nonce: flow.nonce,
    });
    await expect(takeFlow(db, { state: flow.state, now })).resolves.toBeNull();
    expect(await db.select().from(oauthFlows)).toHaveLength(0);
  });

  it('takeFlow con state desconocido, vacío o no string → null', async () => {
    const db = await createTestDb();
    await createFlow(db, now);
    await expect(takeFlow(db, { state: 'desconocido', now })).resolves.toBeNull();
    await expect(takeFlow(db, { state: '', now })).resolves.toBeNull();
    await expect(takeFlow(db, { state: ['a'], now })).resolves.toBeNull();
    await expect(takeFlow(db, { state: undefined, now })).resolves.toBeNull();
  });

  it('takeFlow con flujo expirado → null y lo borra', async () => {
    const db = await createTestDb();
    const flow = await createFlow(db, now);
    const later = new Date(now.getTime() + 6 * MIN);
    await expect(takeFlow(db, { state: flow.state, now: later })).resolves.toBeNull();
    expect(await db.select().from(oauthFlows)).toHaveLength(0);
  });

  it('createFlow limpia los flujos ya expirados', async () => {
    const db = await createTestDb();
    await createFlow(db, now);
    await createFlow(db, new Date(now.getTime() + 6 * MIN));
    expect(await db.select().from(oauthFlows)).toHaveLength(1);
  });
});
