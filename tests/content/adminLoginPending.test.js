import { describe, it, expect } from 'vitest';
import { markLoginPending, takeLoginPending } from '@/admin/lib/loginPending.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

const broken = {
  getItem() {
    throw new Error('bloqueado');
  },
  setItem() {
    throw new Error('bloqueado');
  },
  removeItem() {
    throw new Error('bloqueado');
  },
};

describe('login con Google pendiente', () => {
  it('marca solo un indicador "1", nunca la ruta', () => {
    const storage = memoryStorage();
    markLoginPending(storage);
    expect([...storage.data.entries()]).toEqual([['panel-login-pending', '1']]);
  });

  it('takeLoginPending devuelve true una sola vez y limpia el indicador', () => {
    const storage = memoryStorage();
    markLoginPending(storage);
    expect(takeLoginPending(storage)).toBe(true);
    expect(storage.data.size).toBe(0);
    expect(takeLoginPending(storage)).toBe(false);
  });

  it('sin indicador → false', () => {
    expect(takeLoginPending(memoryStorage())).toBe(false);
  });

  it('con el almacenamiento bloqueado no lanza', () => {
    expect(() => markLoginPending(broken)).not.toThrow();
    expect(takeLoginPending(broken)).toBe(false);
  });
});
