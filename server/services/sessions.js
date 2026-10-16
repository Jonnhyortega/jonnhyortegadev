import { and, desc, eq, gt, or } from 'drizzle-orm';
import { serialize } from 'cookie';
import { sessions } from '../db/schema.js';
import { randomToken, sha256 } from '../lib/crypto.js';

export const SESSION_COOKIE = '__Host-session';

const MIN = 60_000;
// Duración absoluta por tipo de sesión.
const LIFETIME_MS = { full: 8 * 60 * MIN, recovery: 15 * MIN };
// Solo las sesiones `full` caducan por inactividad.
const FULL_IDLE_MS = 30 * MIN;

// Columnas seguras para listar: nunca el hash del token ni el secreto CSRF.
const publicColumns = {
  id: sessions.id,
  kind: sessions.kind,
  createdAt: sessions.createdAt,
  lastSeenAt: sessions.lastSeenAt,
  expiresAt: sessions.expiresAt,
  ipHash: sessions.ipHash,
  userAgent: sessions.userAgent,
};

// Crea una sesión. El token en claro solo vive en la cookie; en la BD se
// guarda su sha256. `lifetimeMs` opcional solo puede acortar la duración.
export async function createSession(db, { kind, ipHash, userAgent, now, lifetimeMs }) {
  const maxLifetime = LIFETIME_MS[kind];
  if (!maxLifetime) throw new Error(`Unknown session kind: ${kind}`);
  const lifetime = lifetimeMs === undefined ? maxLifetime : Math.min(lifetimeMs, maxLifetime);

  const token = randomToken();
  const csrfToken = randomToken();
  const [session] = await db
    .insert(sessions)
    .values({
      tokenHash: sha256(token),
      csrfSecret: csrfToken,
      kind,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + lifetime),
      ipHash: ipHash ?? null,
      userAgent: userAgent ?? null,
    })
    .returning();
  return { token, csrfToken, session };
}

function isExpired(session, now) {
  if (now.getTime() >= session.expiresAt.getTime()) return true;
  return session.kind === 'full' && now.getTime() - session.lastSeenAt.getTime() > FULL_IDLE_MS;
}

// Devuelve la sesión del token o null. Si está caducada la borra; si es
// válida actualiza last_seen_at (no extiende expires_at).
export async function getSession(db, { token, now }) {
  if (typeof token !== 'string' || token.length === 0) return null;

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, sha256(token)))
    .limit(1);
  if (!session) return null;

  if (isExpired(session, now)) {
    await deleteSession(db, session.id);
    return null;
  }

  await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, session.id));
  return { ...session, lastSeenAt: now };
}

export async function deleteSession(db, id) {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function deleteAllSessions(db) {
  const deleted = await db.delete(sessions).returning({ id: sessions.id });
  return deleted.length;
}

// Sesiones vigentes, más recientes primero, sin datos secretos.
export async function listSessions(db, now) {
  const idleLimit = new Date(now.getTime() - FULL_IDLE_MS);
  return db
    .select(publicColumns)
    .from(sessions)
    .where(
      and(
        gt(sessions.expiresAt, now),
        or(eq(sessions.kind, 'recovery'), gt(sessions.lastSeenAt, idleLimit)),
      ),
    )
    .orderBy(desc(sessions.createdAt));
}

const cookieAttributes = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
};

export function setSessionCookie(res, token, maxAgeMs) {
  res.append(
    'Set-Cookie',
    serialize(SESSION_COOKIE, token, {
      ...cookieAttributes,
      maxAge: Math.floor(maxAgeMs / 1000),
    }),
  );
}

export function clearSessionCookie(res) {
  res.append('Set-Cookie', serialize(SESSION_COOKIE, '', { ...cookieAttributes, maxAge: 0 }));
}
