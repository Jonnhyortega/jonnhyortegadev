import { describe, it, expect } from 'vitest';
import { randomToken, sha256, hmacIp, safeEqual } from '../../server/lib/crypto.js';

describe('safeEqual', () => {
  it('true para strings iguales', () => {
    expect(safeEqual('abc123', 'abc123')).toBe(true);
  });

  it('false con longitudes distintas', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('false con misma longitud y contenido distinto', () => {
    expect(safeEqual('abcd', 'abce')).toBe(false);
  });

  it('maneja caracteres no ASCII', () => {
    expect(safeEqual('ñandú', 'ñandú')).toBe(true);
    expect(safeEqual('ñandú', 'nandu')).toBe(false);
    // Misma longitud en caracteres, distinta en bytes.
    expect(safeEqual('ñ', 'n')).toBe(false);
  });

  it('false (sin lanzar) si algún argumento no es string', () => {
    expect(safeEqual(null, 'null')).toBe(false);
    expect(safeEqual('null', null)).toBe(false);
    expect(safeEqual(undefined, 'undefined')).toBe(false);
    expect(safeEqual(null, null)).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(false);
    expect(safeEqual(123, '123')).toBe(false);
    expect(safeEqual(['a'], 'a')).toBe(false);
    expect(safeEqual({ toString: () => 'x' }, 'x')).toBe(false);
  });
});

describe('hmacIp', () => {
  it('es determinista', () => {
    expect(hmacIp('secreto', '1.2.3.4')).toBe(hmacIp('secreto', '1.2.3.4'));
  });

  it('depende del secreto y de la IP', () => {
    expect(hmacIp('secreto-a', '1.2.3.4')).not.toBe(hmacIp('secreto-b', '1.2.3.4'));
    expect(hmacIp('secreto', '1.2.3.4')).not.toBe(hmacIp('secreto', '1.2.3.5'));
  });

  it('devuelve hex de 64 caracteres sin incluir la IP', () => {
    const value = hmacIp('secreto', '1.2.3.4');
    expect(value).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('sha256', () => {
  it('vector conocido para "abc"', () => {
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('randomToken', () => {
  it('32 bytes por defecto en base64url (43 caracteres)', () => {
    const token = randomToken();
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('respeta el tamaño pedido', () => {
    expect(randomToken(16)).toHaveLength(22);
  });

  it('no se repite', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => randomToken()));
    expect(tokens.size).toBe(200);
  });
});
