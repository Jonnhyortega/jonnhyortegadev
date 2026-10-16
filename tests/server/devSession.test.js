import { describe, it, expect } from 'vitest';
import { assertDevFakeSessionAllowed } from '../../server/config/devSession.js';

const base = {
  DATABASE_URL: 'postgres://prod',
  DEV_DATABASE_URL: 'postgres://dev',
};

describe('assertDevFakeSessionAllowed', () => {
  it('permite y devuelve la URL de la BD de desarrollo', () => {
    expect(assertDevFakeSessionAllowed({ ...base })).toBe('postgres://dev');
    expect(assertDevFakeSessionAllowed({ ...base, NODE_ENV: 'development' })).toBe('postgres://dev');
  });

  it('rechaza con VERCEL_ENV definido', () => {
    for (const VERCEL_ENV of ['production', 'preview', 'development']) {
      expect(() => assertDevFakeSessionAllowed({ ...base, VERCEL_ENV })).toThrow(/VERCEL_ENV/);
    }
  });

  it('rechaza con NODE_ENV=production', () => {
    expect(() => assertDevFakeSessionAllowed({ ...base, NODE_ENV: 'production' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('rechaza sin DEV_DATABASE_URL', () => {
    expect(() => assertDevFakeSessionAllowed({ DATABASE_URL: 'postgres://prod' })).toThrow(
      /DEV_DATABASE_URL/,
    );
    expect(() =>
      assertDevFakeSessionAllowed({ DATABASE_URL: 'postgres://prod', DEV_DATABASE_URL: '' }),
    ).toThrow(/DEV_DATABASE_URL/);
  });

  it('rechaza si DEV_DATABASE_URL es igual a DATABASE_URL', () => {
    expect(() =>
      assertDevFakeSessionAllowed({ DATABASE_URL: 'postgres://x', DEV_DATABASE_URL: 'postgres://x' }),
    ).toThrow(/DEV_DATABASE_URL/);
  });

  it('el mensaje no incluye valores de las variables', () => {
    expect.assertions(1);
    try {
      assertDevFakeSessionAllowed({ DATABASE_URL: 'postgres://secreto', DEV_DATABASE_URL: 'postgres://secreto' });
    } catch (err) {
      expect(err.message).not.toContain('secreto');
    }
  });
});
