import { describe, it, expect } from 'vitest';
import { loadEnv } from '../../server/config/env.js';

const SECRET = 'x'.repeat(40);

const validSource = (overrides = {}) => ({
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  OAUTH_REDIRECT_URI: 'https://example.com/api/auth/google/callback',
  ADMIN_EMAIL: 'Admin@Example.com',
  APP_ORIGIN: 'https://example.com',
  IP_HASH_SECRET: SECRET,
  VERCEL_ENV: 'production',
  ...overrides,
});

describe('loadEnv', () => {
  it('devuelve el entorno completo y marca isProduction', () => {
    const env = loadEnv(validSource());
    expect(env).toEqual({
      databaseUrl: 'postgres://user:pass@localhost:5432/db',
      googleClientId: 'client-id',
      googleClientSecret: 'client-secret',
      oauthRedirectUri: 'https://example.com/api/auth/google/callback',
      adminEmail: 'admin@example.com',
      appOrigin: 'https://example.com',
      ipHashSecret: SECRET,
      vercelEnv: 'production',
      isProduction: true,
    });
    expect(loadEnv(validSource({ VERCEL_ENV: 'preview' })).isProduction).toBe(false);
  });

  it('falla si falta GOOGLE_CLIENT_SECRET y lo nombra', () => {
    const source = validSource();
    delete source.GOOGLE_CLIENT_SECRET;
    expect(() => loadEnv(source)).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it('rechaza APP_ORIGIN http en producción', () => {
    expect(() => loadEnv(validSource({ APP_ORIGIN: 'http://example.com' }))).toThrow(/APP_ORIGIN/);
  });

  it('rechaza APP_ORIGIN con path en producción', () => {
    expect(() => loadEnv(validSource({ APP_ORIGIN: 'https://example.com/admin' }))).toThrow(/APP_ORIGIN/);
  });

  it('rechaza OAUTH_REDIRECT_URI http en producción', () => {
    expect(() =>
      loadEnv(validSource({ OAUTH_REDIRECT_URI: 'http://example.com/cb' })),
    ).toThrow(/OAUTH_REDIRECT_URI/);
  });

  it('permite http fuera de producción', () => {
    const env = loadEnv(
      validSource({
        VERCEL_ENV: 'development',
        APP_ORIGIN: 'http://localhost:5173',
        OAUTH_REDIRECT_URI: 'http://localhost:3000/api/auth/google/callback',
      }),
    );
    expect(env.isProduction).toBe(false);
  });

  it('rechaza IP_HASH_SECRET de menos de 32 caracteres', () => {
    expect(() => loadEnv(validSource({ IP_HASH_SECRET: 'corto' }))).toThrow(/IP_HASH_SECRET/);
  });

  it('el mensaje de error nunca incluye valores', () => {
    const leaked = 'secreto-super-corto';
    let message = '';
    try {
      loadEnv(validSource({ IP_HASH_SECRET: leaked }));
    } catch (e) {
      message = e.message;
    }
    expect(message).toMatch(/^Invalid environment: /);
    expect(message).not.toContain(leaked);
  });

  it('normaliza ADMIN_EMAIL a minúsculas', () => {
    expect(loadEnv(validSource({ ADMIN_EMAIL: 'JoNNHY@Mail.COM' })).adminEmail).toBe('jonnhy@mail.com');
  });

  it('VERCEL_ENV ausente equivale a development', () => {
    const source = validSource();
    delete source.VERCEL_ENV;
    const env = loadEnv(source);
    expect(env.vercelEnv).toBe('development');
    expect(env.isProduction).toBe(false);
  });
});
