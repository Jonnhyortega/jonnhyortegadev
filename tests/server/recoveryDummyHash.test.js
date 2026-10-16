import { describe, it, expect, vi, beforeEach } from 'vitest';

// argon2 simulado: permite contar los hash y hacer fallar el primero.
const argon2 = vi.hoisted(() => ({ hash: vi.fn(), verify: vi.fn() }));
vi.mock('@node-rs/argon2', () => argon2);

// BD mínima: no hay códigos sin usar, así que todo se rellena con el hash ficticio.
const emptyDb = {
  select: () => ({ from: () => ({ where: async () => [] }) }),
};

beforeEach(() => {
  vi.resetModules();
  argon2.hash.mockReset();
  argon2.verify.mockReset().mockResolvedValue(false);
});

describe('hash ficticio de los códigos de recuperación', () => {
  it('se calcula al cargar el módulo, una sola vez', async () => {
    argon2.hash.mockResolvedValue('$argon2id$dummy');
    const mod = await import('../../server/services/recoveryCodes.js');
    expect(argon2.hash).toHaveBeenCalledTimes(1);

    const now = new Date();
    expect(await mod.consumeRecoveryCode(emptyDb, { code: 'ABCD-EFGH-JKMN', now })).toBe(false);
    expect(await mod.consumeRecoveryCode(emptyDb, { code: 'ABCD-EFGH-JKMN', now })).toBe(false);
    expect(argon2.hash).toHaveBeenCalledTimes(1);
    expect(argon2.verify).toHaveBeenCalledTimes(20);
  });

  it('si el cálculo falla, el siguiente intento lo reintenta (no queda roto para siempre)', async () => {
    argon2.hash.mockRejectedValueOnce(new Error('fallo transitorio')).mockResolvedValue('$argon2id$dummy');
    const mod = await import('../../server/services/recoveryCodes.js');
    expect(argon2.hash).toHaveBeenCalledTimes(1);
    // Deja que se procese el rechazo de la carga.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const now = new Date();
    expect(await mod.consumeRecoveryCode(emptyDb, { code: 'ABCD-EFGH-JKMN', now })).toBe(false);
    expect(argon2.hash).toHaveBeenCalledTimes(2);
    expect(argon2.verify).toHaveBeenCalledTimes(10);
  });
});
