import { Router } from 'express';
import { asc, eq, sql } from 'drizzle-orm';
import { adminIdentity } from '../db/schema.js';
import { safeEqual } from '../lib/crypto.js';
import { productionOnly } from '../middleware/productionOnly.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { loadSession, requireSession } from '../middleware/session.js';
import { requireCsrf } from '../middleware/csrf.js';
import { recordAudit, requestContext } from '../services/audit.js';
import { createFlow, takeFlow } from '../services/oauthFlows.js';
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  setSessionCookie,
} from '../services/sessions.js';

const MIN = 60_000;
// La middleware (Task 15) convierte esta ruta en un 302 hacia el panel.
const PANEL_RETURN = '/__panel-return';

// Router de /api/auth: login con Google (OAuth + PKCE) y logout.
export function createAuthRouter({ env, db, google, now }) {
  const router = Router();

  const loginLimit = rateLimit({
    db,
    now,
    name: 'login',
    limit: 10,
    windowMs: MIN,
    keyFrom: (req) => requestContext(req, env).ipHash,
  });

  router.use(productionOnly(env));
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/google/start', loginLimit, async (req, res) => {
    const flow = await createFlow(db, now());
    res.redirect(
      302,
      google.buildAuthUrl({
        state: flow.state,
        codeChallenge: flow.codeChallenge,
        nonce: flow.nonce,
      }),
    );
  });

  router.get('/google/callback', loginLimit, loadSession({ db, now }), async (req, res) => {
    const context = requestContext(req, env);
    // Nunca se repite el texto de error de Google ni se guardan code/tokens.
    const reject = async (reason) => {
      await recordAudit(db, { event: 'login_rejected', ...context, meta: { reason }, now: now() });
      res.redirect(302, `${PANEL_RETURN}?error=1`);
    };

    const { code, state } = req.query;
    const flow = await takeFlow(db, { state, now: now() });
    if (!flow) return reject('invalid_state');

    if (typeof code !== 'string' || code.length === 0) return reject('exchange_failed');
    let idToken;
    try {
      ({ idToken } = await google.exchangeCode({ code, codeVerifier: flow.codeVerifier }));
    } catch {
      return reject('exchange_failed');
    }

    let identity;
    try {
      identity = await google.verifyIdToken(idToken, { nonce: flow.nonce });
    } catch {
      return reject('invalid_token');
    }

    if (typeof identity.email !== 'string' || identity.email.toLowerCase() !== env.adminEmail) {
      return reject('email_not_allowed');
    }
    if (identity.emailVerified !== true) return reject('email_not_verified');
    if (!(await bindAdminIdentity(db, { email: env.adminEmail, sub: identity.sub }))) {
      return reject('sub_mismatch');
    }

    // Contra fijación de sesión: la sesión previa (si la hay) se descarta y
    // siempre se emite un token nuevo.
    if (req.session) await deleteSession(db, req.session.id);
    const issuedAt = now();
    const { token, session } = await createSession(db, {
      kind: 'full',
      ipHash: context.ipHash,
      userAgent: context.userAgent,
      now: issuedAt,
    });
    setSessionCookie(res, token, session.expiresAt.getTime() - issuedAt.getTime());
    await recordAudit(db, { event: 'login_success', ...context, now: issuedAt });
    res.redirect(302, PANEL_RETURN);
  });

  router.post(
    '/logout',
    loadSession({ db, now }),
    requireSession('full', 'recovery'),
    requireCsrf(env),
    async (req, res) => {
      await deleteSession(db, req.session.id);
      clearSessionCookie(res);
      await recordAudit(db, { event: 'logout', ...requestContext(req, env), now: now() });
      res.status(204).end();
    },
  );

  return router;
}

// admin_identity tiene una sola fila. Si está vacía se crea con este sub; si
// no tiene sub se completa; si ya tiene otro sub, se rechaza (false).
async function bindAdminIdentity(db, { email, sub }) {
  return db.transaction(async (tx) => {
    // Serializa logins concurrentes (evita dos inserciones con la tabla vacía).
    await tx.execute(sql`lock table ${adminIdentity} in share row exclusive mode`);
    const [row] = await tx
      .select()
      .from(adminIdentity)
      .orderBy(asc(adminIdentity.createdAt), asc(adminIdentity.id))
      .limit(1);

    if (!row) {
      await tx.insert(adminIdentity).values({ email, googleSub: sub });
      return true;
    }
    if (row.googleSub === null) {
      await tx.update(adminIdentity).set({ googleSub: sub }).where(eq(adminIdentity.id, row.id));
      return true;
    }
    return safeEqual(row.googleSub, sub);
  });
}
