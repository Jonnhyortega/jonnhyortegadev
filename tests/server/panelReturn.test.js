import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { PANEL_RETURN_TTL_MS, signPanelReturn, verifyPanelReturn } from '../../server/lib/panelReturn.js';

const SECRET = 'test-panel-return-secret-0123456789abcdef';
const NOW = Date.parse('2026-01-01T00:00:00Z');

describe('cookie de retorno al panel', () => {
  it('acepta una firma recién emitida', async () => {
    const value = await signPanelReturn(SECRET, NOW + PANEL_RETURN_TTL_MS);
    expect(await verifyPanelReturn(SECRET, value, NOW)).toBe(true);
  });

  it('tolera 5 s de desfase de reloj entre función y middleware', async () => {
    const value = await signPanelReturn(SECRET, NOW + PANEL_RETURN_TTL_MS);
    // La middleware va 4 s atrasada respecto de quien firmó.
    expect(await verifyPanelReturn(SECRET, value, NOW - 4000)).toBe(true);
    expect(await verifyPanelReturn(SECRET, value, NOW - 5000)).toBe(true);
  });

  it('rechaza un vencimiento más allá de TTL + 5 s', async () => {
    const value = await signPanelReturn(SECRET, NOW + PANEL_RETURN_TTL_MS + 5001);
    expect(await verifyPanelReturn(SECRET, value, NOW)).toBe(false);
  });

  it('rechaza una firma vencida', async () => {
    const value = await signPanelReturn(SECRET, NOW);
    expect(await verifyPanelReturn(SECRET, value, NOW)).toBe(false);
  });

  it.each([undefined, null, '', 'corto', 'x'.repeat(31), 12345])(
    'falla cerrado con un secreto inválido o de menos de 32 caracteres: %s',
    async (secret) => {
      const value = await signPanelReturn(SECRET, NOW + 60_000);
      expect(await verifyPanelReturn(secret, value, NOW)).toBe(false);
    },
  );

  it('con un secreto corto no verifica ni una firma hecha con ese mismo secreto', async () => {
    const weak = 'x'.repeat(31);
    const expiresAt = String(NOW + 60_000);
    const sig = createHmac('sha256', weak).update(expiresAt).digest('base64url');
    expect(await verifyPanelReturn(weak, `${expiresAt}.${sig}`, NOW)).toBe(false);
  });

  it('se niega a firmar con un secreto de menos de 32 caracteres', async () => {
    await expect(signPanelReturn('x'.repeat(31), NOW + 60_000)).rejects.toThrow();
    await expect(signPanelReturn(undefined, NOW + 60_000)).rejects.toThrow();
  });

  it('acepta un secreto de exactamente 32 caracteres', async () => {
    const secret = 'y'.repeat(32);
    const value = await signPanelReturn(secret, NOW + 60_000);
    expect(await verifyPanelReturn(secret, value, NOW)).toBe(true);
  });
});
