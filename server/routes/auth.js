import { Router } from 'express';
import { parse, serialize } from 'cookie';
import { asc, eq, sql } from 'drizzle-orm';
import { adminIdentity } from '../db/schema.js';
import { safeEqual, sha256 } from '../lib/crypto.js';
import { productionOnly } from '../middleware/productionOnly.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { loadSession, requireSession } from '../middleware/session.js';
import { requireCsrf, requireSameOrigin } from '../middleware/csrf.js';
import { PANEL_RETURN_TTL_MS, signPanelReturn } from '../lib/panelReturn.js';
import { HttpError } from '../lib/errors.js';
import { recoveryRequestSchema } from '../schemas/auth.js';
import { recordAudit, requestContext } from '../services/audit.js';
import { registerFailureUnlessLocked, resetFailures } from '../services/rateLimit.js';
import { consumeRecoveryCode, normalizeCode } from '../services/recoveryCodes.js';
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
const HOUR = 60 * MIN;
const RECOVERY_LOCK_KEY = 'recovery:global';
// La middleware (Task 15) convierte esta ruta en un 302 hacia el panel.
const PANEL_RETURN = '/__panel-return';
// Cookie firmada y de vida corta (R29/R31): la middleware solo revela la ruta a quien
// viene de un callback (R29). Sin ella, /__panel-return no existe.
const PANEL_RETURN_COOKIE = '__Host-panel-return';

// Router de /api/auth: login con Google (OAuth + PKCE), recuperación y logout.
export function createAuthRouter({ env, db, google, now }) {
  const router = Router();

  // El valor va firmado (HMAC): la middleware solo acepta cookies que emitió este callback.
  async function redirectToPanel(res, location) {
    const expiresAtMs = now().getTime() + PANEL_RETURN_TTL_MS;
    res.append(
      'Set-Cookie',
      serialize(PANEL_RETURN_COOKIE, await signPanelReturn(env.panelReturnSecret, expiresAtMs), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: PANEL_RETURN_TTL_MS / 1000,
      }),
    );
    res.redirect(302, location);
  }

  const loginLimit = rateLimit({
    db,
    now,
    name: 'login',
    limit: 10,
    windowMs: MIN,
    keyFrom: (req) => requestContext(req, env).ipHash,
  });

  const recoveryLimit = rateLimit({
    db,
    now,
    name: 'recovery-ip',
    limit: 5,
    windowMs: HOUR,
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
        return await redirectToPanel(res, failRedirect);
      }
      setSessionCookie(res, result.token, result.maxAgeMs);
      return await redirectToPanel(res, PANEL_RETURN);
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
      await redirectToPanel(res, failRedirect);
    }
  });

  // Acceso con código de recuperación: abre una sesión `recovery` (15 min).
  // Con el bloqueo global activo no se evalúa el código ni se cuenta el fallo.
  router.post('/recovery', requireSameOrigin(env), recoveryLimit, async (req, res) => {
    const parsed = recoveryRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'invalid_input');
    const context = requestContext(req, env);

    // El fallo se cuenta ANTES de verificar, en la misma sentencia que
    // comprueba el bloqueo (sin ventana check-then-act entre peticiones
    // concurrentes). Si ya hay bloqueo: 429, sin evaluar ni contar el fallo.
    // Si el código resulta válido, el contador se reinicia.
    const registered = await registerFailureUnlessLocked(db, {
      key: RECOVERY_LOCK_KEY,
      now: now(),
    });
    if (registered.locked) {
      await recordAudit(db, { event: 'recovery_locked', ...context, now: now() });
      const retryAfterMs = (registered.lockedUntil?.getTime() ?? 0) - now().getTime();
      res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
      throw new HttpError(429, 'rate_limited');
    }

    // Un formato inválido es un fallo más, pero sin coste de argon2.
    const code = normalizeCode(parsed.data.code);
    const valid = code !== '' && (await consumeRecoveryCode(db, { code, now: now() }));
    if (!valid) {
      await recordAudit(db, { event: 'recovery_failed', ...context, now: now() });
      throw new HttpError(401, 'invalid_code');
    }

    await resetFailures(db, { key: RECOVERY_LOCK_KEY });
    const issuedAt = now();
    const { token, session } = await db.transaction(async (tx) => {
      const created = await createSession(tx, {
        kind: 'recovery',
        ipHash: context.ipHash,
        userAgent: context.userAgent,
        now: issuedAt,
      });
      await recordAudit(tx, { event: 'recovery_success', ...context, now: issuedAt });
      return created;
    });
    setSessionCookie(res, token, session.expiresAt.getTime() - issuedAt.getTime());
    res.json({ ok: true });
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
