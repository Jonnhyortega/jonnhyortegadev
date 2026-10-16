import { Router } from 'express';
import { adminIdentity } from '../../db/schema.js';
import { generateRecoveryCodes } from '../../services/recoveryCodes.js';
import { listSessions, deleteSession, deleteAllSessions, clearSessionCookie } from '../../services/sessions.js';
import { listAudit, recordAudit, requestContext } from '../../services/audit.js';

const AUDIT_LIMIT = 50;

// POST /security/recovery-codes: única ruta, además de /me, que admite una
// sesión `recovery`. Se monta ANTES de la puerta full-only (R18). Con sesión
// `recovery` la recuperación termina aquí: se invalida la sesión.
export function createRecoveryCodesHandler(deps) {
  const { env, db, now } = deps;
  return async (req, res) => {
    const at = now();
    const codes = await generateRecoveryCodes(db, at);
    await recordAudit(db, {
      event: 'recovery_codes_generated',
      ...requestContext(req, env),
      now: at,
    });
    if (req.session.kind === 'recovery') {
      await deleteSession(db, req.session.id);
      clearSessionCookie(res);
    }
    res.set('Cache-Control', 'no-store');
    res.json({ codes });
  };
}

// POST /security/identity/reset: SOLO con sesión `recovery` (spec §4: una sesión
// de recuperación permite vincular Google de nuevo). Desvincula la cuenta de
// Google (google_sub = NULL) y fija el email a ADMIN_EMAIL; el próximo login con
// Google vuelve a vincular por el camino del primer login (R38). La sesión de
// recuperación termina aquí. Se monta ANTES de la puerta full-only.
export function createIdentityResetHandler(deps) {
  const { env, db, now } = deps;
  return async (req, res) => {
    const at = now();
    await db.transaction(async (tx) => {
      await tx.update(adminIdentity).set({ googleSub: null, email: env.adminEmail });
      await recordAudit(tx, { event: 'identity_reset', ...requestContext(req, env), now: at });
      await deleteSession(tx, req.session.id);
    });
    clearSessionCookie(res);
    res.status(204).end();
  };
}

// Rutas de seguridad que exigen sesión `full` (se montan tras la puerta).
export function createSecurityRouter(deps) {
  const { env, db, now } = deps;
  const router = Router();

  router.get('/audit', async (req, res) => {
    const rows = await listAudit(db, { limit: AUDIT_LIMIT });
    res.json(rows.map(({ event, createdAt, meta }) => ({ event, createdAt, meta })));
  });

  router.get('/sessions', async (req, res) => {
    const rows = await listSessions(db, now());
    res.json(
      rows.map(({ id, kind, createdAt, lastSeenAt, userAgent }) => ({
        id,
        kind,
        createdAt,
        lastSeenAt,
        userAgent,
        current: id === req.session.id,
      })),
    );
  });

  router.delete('/sessions', async (req, res) => {
    const count = await deleteAllSessions(db);
    await recordAudit(db, {
      event: 'sessions_revoked',
      ...requestContext(req, env),
      meta: { count },
      now: now(),
    });
    clearSessionCookie(res);
    res.status(204).end();
  });

  return router;
}
