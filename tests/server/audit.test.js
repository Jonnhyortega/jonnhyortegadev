import { describe, it, expect } from 'vitest';
import { createTestDb } from './helpers/db.js';
import { recordAudit, listAudit, requestContext } from '../../server/services/audit.js';
import { auditLog } from '../../server/db/schema.js';

describe('auditoría', () => {
  it('registra y lista en orden descendente por fecha', async () => {
    const db = await createTestDb();
    await recordAudit(db, { event: 'login_success', now: new Date('2026-01-01T00:00:00Z') });
    await recordAudit(db, { event: 'logout', now: new Date('2026-01-01T01:00:00Z') });
    await recordAudit(db, { event: 'content_updated', now: new Date('2026-01-01T02:00:00Z') });
    const rows = await listAudit(db, { limit: 2 });
    expect(rows.map((r) => r.event)).toEqual(['content_updated', 'logout']);
  });

  it('elimina claves sensibles de meta, también anidadas', async () => {
    const db = await createTestDb();
    await recordAudit(db, {
      event: 'recovery_failed',
      ipHash: 'abc',
      userAgent: 'ua',
      meta: {
        reason: 'bad',
        token: 't',
        Code: 'c',
        password: 'p',
        Cookie: 'k',
        secret: 's',
        nested: { sessionToken: 'x', keep: 1 },
      },
      now: new Date(),
    });
    const [row] = await db.select().from(auditLog);
    expect(row.meta).toEqual({ reason: 'bad', nested: { keep: 1 } });
    expect(row.ipHash).toBe('abc');
  });

  it('requestContext no devuelve la IP original y trunca el user agent', () => {
    const req = { ip: '203.0.113.9', get: () => 'x'.repeat(500) };
    const ctx = requestContext(req, { ipHashSecret: 'secret-secret-secret-secret-1234' });
    expect(ctx.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ctx)).not.toContain('203.0.113.9');
    expect(ctx.userAgent).toHaveLength(300);
  });
});
