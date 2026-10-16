import { Router } from 'express';
import { parse } from 'cookie';
import { asc, eq, sql } from 'drizzle-orm';
import { adminIdentity } from '../db/schema.js';
import { safeEqual, sha256 } from '../lib/crypto.js';
import { productionOnly } from '../middleware/productionOnly.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { loadSession, requireSession } from '../middleware/session.js';
import { requireCsrf } from '../middleware/csrf.js';
import { recordAudit, requestContext } from '../services/audit.js';
import {
  OAUTH_COOKIE,
  clearFlowCookie,
  createFlow,
  setFlowCookie,
  takeFlow,
} from '../services/oauthFlows.js';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  deleteSession,
  getSession,
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
    setFlowCookie(res, flow.binding);
    res.redirect(
      302,
      google.buildAuthUrl({
        state: flow.state,
        codeChallenge: flow.codeChallenge,
        nonce: flow.nonce,
      }),
    );
  });

  // Valida el callback en orden. Devuelve el motivo de rechazo, o
  // { token, maxAgeMs } de la sesión nueva si todo es correcto.
  async function completeLogin(req, context) {
    const cookies = parse(req.headers.cookie ?? '');
    const { code, state } = req.query;

    // El flujo se consume siempre, aunque luego falle el binding.
    const flow = await takeFlow(db, { state, now: now() });
    if (!flow) return { reason: 'invalid_state' };
    const binding = cookies[OAUTH_COOKIE];
    if (typeof binding !== 'string' || !safeEqual(sha256(binding), flow.bindingHash)) {
      return { reason: 'invalid_state' };
    }

    if (typeof code !== 'string' || code.length === 0) return { reason: 'exchange_failed' };
    let idToken;
    try {
      ({ idToken } = await google.exchangeCode({ code, codeVerifier: flow.codeVerifier }));
    } catch {
      return { reason: 'exchange_failed' };
    }

    let identity;
    try {
      identity = await google.verifyIdToken(idToken, { nonce: flow.nonce });
    } catch {
      return { reason: 'invalid_token' };
    }

    if (typeof identity.email !== 'string' || identity.email.toLowerCase() !== env.adminEmail) {
      return { reason: 'email_not_allowed' };
    }
    if (identity.emailVerified !== true) return { reason: 'email_not_verified' };
    if (!(await bindAdminIdentity(db, { email: env.adminEmail, sub: identity.sub }))) {
      return { reason: 'sub_mismatch' };
    }

    // Contra fijación de sesión: la sesión previa (si la hay) se descarta y
    // siempre se emite un token nuevo. Sesión y auditoría van en una sola
    // transacción: sin login_success registrado no hay sesión ni cookie.
    const previousToken = cookies[SESSION_COOKIE];
    const previous = previousToken ? await getSession(db, { token: previousToken, now: now() }) : null;
    const issuedAt = now();
    const { token, session } = await db.transaction(async (tx) => {
      if (previous) await deleteSession(tx, previous.id);
      const created = await createSession(tx, {
        kind: 'full',
        ipHash: context.ipHash,
        userAgent: context.userAgent,
        now: issuedAt,
      });
      await recordAudit(tx, { event: 'login_success', ...context, now: issuedAt });
      return created;
    });
    return { token, maxAgeMs: session.expiresAt.getTime() - issuedAt.getTime() };
  }

  router.get('/google/callback', loginLimit, async (req, res) => {
    const context = requestContext(req, env);
    const failRedirect = `${PANEL_RETURN}?error=1`;
    // La cookie de binding se borra siempre, con éxito o con error.
    clearFlowCookie(res);

    try {
      const result = await completeLogin(req, context);
      if (result.reason) {
        // Nunca se repite el texto de error de Google ni se guardan code/tokens.
        await recordAudit(db, {
          event: 'login_rejected',
          ...context,
          meta: { reason: result.reason },
          now: now(),
        });
        return res.redirect(302, failRedirect);
      }
      setSessionCookie(res, result.token, result.maxAgeMs);
      return res.redirect(302, PANEL_RETURN);
    } catch (err) {
      // Error inesperado (BD, etc.): solo se registra id de petición y stack.
      console.error(`[${req.id}]`, err?.stack ?? String(err));
      try {
        await recordAudit(db, {
          event: 'login_rejected',
          ...context,
          meta: { reason: 'internal_error' },
          now: now(),
        });
      } catch {
        // auditoría de mejor esfuerzo
      }
      if (res.headersSent) return;
      // Por si acaso: ninguna cookie de sesión sale en una respuesta de error.
      res.removeHeader('Set-Cookie');
      clearFlowCookie(res);
      res.redirect(302, failRedirect);
    }
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
