import { describe, it, expect } from 'vitest';
import { isPgliteMemoryUrl, createDevPgliteDb } from '../../server/db/devPglite.js';
import { translations, projects } from '../../server/db/schema.js';

describe('devPglite', () => {
  it('solo reconoce la URL exacta pglite:memory', () => {
    expect(isPgliteMemoryUrl('pglite:memory')).toBe(true);
    expect(isPgliteMemoryUrl('postgres://x')).toBe(false);
    expect(isPgliteMemoryUrl(undefined)).toBe(false);
  });

  it('crea una BD en memoria migrada y sembrada', async () => {
    const db = await createDevPgliteDb();
    expect(await db.select().from(translations)).toHaveLength(1);
    expect((await db.select().from(projects)).length).toBeGreaterThan(0);
  });
});
