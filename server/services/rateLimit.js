import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { rateLimits } from '../db/schema.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Probabilidad de que una llamada a consume purgue filas viejas (1 de cada 100).
const PURGE_PROBABILITY = 0.01;

const ts = (date) => sql`${date.toISOString()}::timestamptz`;
const ms = (value) => sql`(${value}::double precision * interval '1 millisecond')`;

// Ventana fija con upsert atómico: una sola sentencia incrementa o reinicia.
// De forma oportunista (según `random`, inyectable en tests) purga filas viejas.
export async function consume(db, { key, limit, windowMs, now, random = Math.random }) {
  const nowTs = ts(now);
  const expired = sql`${nowTs} - ${rateLimits.windowStart} >= ${ms(windowMs)}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, windowStart: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then ${nowTs} else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  if (random() < PURGE_PROBABILITY) await purgeStaleRateLimits(db, now);

  if (row.count <= limit) return { allowed: true, retryAfterMs: 0 };
  const retryAfterMs = row.windowStart.getTime() + windowMs - now.getTime();
  return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
}

// Borra las filas que ya no influyen en ningún límite: ventana de hace más de
// 24 h, sin bloqueo vigente y sin fallos en las últimas 24 h (la escala de
// bloqueo los reinicia pasado ese plazo). Devuelve cuántas borró.
export async function purgeStaleRateLimits(db, now) {
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const deleted = await db
    .delete(rateLimits)
    .where(
      and(
        lt(rateLimits.windowStart, dayAgo),
        or(isNull(rateLimits.lockedUntil), lt(rateLimits.lockedUntil, now)),
        or(isNull(rateLimits.lastFailureAt), lt(rateLimits.lastFailureAt, dayAgo)),
      ),
    )
    .returning({ key: rateLimits.key });
  return deleted.length;
}

// Cuenta un fallo y fija el bloqueo según la escala 10 -> 15 min, 15 -> 1 h, 20 -> 24 h.
// Los fallos se reinician si pasaron 24 h desde el último.
export async function registerFailure(db, { key, now }) {
  const row = await upsertFailure(db, { key, now, onlyIfUnlocked: false });
  return { failures: row.failures, lockedUntil: row.lockedUntil ?? null };
}

// Igual que registerFailure, pero en una sola sentencia atómica NO cuenta el
// fallo si la clave ya está bloqueada: devuelve { locked: true, lockedUntil }.
// Así, entre peticiones concurrentes, solo las que caben antes del bloqueo
// llegan a evaluarse.
export async function registerFailureUnlessLocked(db, { key, now }) {
  const row = await upsertFailure(db, { key, now, onlyIfUnlocked: true });
  if (row) return { locked: false, failures: row.failures, lockedUntil: row.lockedUntil ?? null };
  return { locked: true, lockedUntil: await getLock(db, { key, now }) };
}

async function upsertFailure(db, { key, now, onlyIfUnlocked }) {
  const nowTs = ts(now);
  const stale = sql`${rateLimits.lastFailureAt} < ${nowTs} - ${ms(DAY_MS)}`;
  const newFailures = sql`(case when ${stale} then 1 else ${rateLimits.failures} + 1 end)`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, failures: 1, lastFailureAt: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        failures: newFailures,
        lastFailureAt: sql`${nowTs}`,
        lockedUntil: sql`case
          when ${newFailures} >= 20 then ${nowTs} + ${ms(DAY_MS)}
          when ${newFailures} >= 15 then ${nowTs} + ${ms(HOUR_MS)}
          when ${newFailures} >= 10 then ${nowTs} + ${ms(15 * 60 * 1000)}
          else ${rateLimits.lockedUntil}
        end`,
      },
      setWhere: onlyIfUnlocked
        ? sql`${rateLimits.lockedUntil} is null or ${rateLimits.lockedUntil} <= ${nowTs}`
        : undefined,
    })
    .returning({ failures: rateLimits.failures, lockedUntil: rateLimits.lockedUntil });
  return row;
}

// Borra en una sola sentencia el contador de fallos y el bloqueo de la clave.
export async function resetFailures(db, { key }) {
  await db
    .update(rateLimits)
    .set({ failures: 0, lockedUntil: null, lastFailureAt: null })
    .where(eq(rateLimits.key, key));
}

export async function getLock(db, { key, now }) {
  const [row] = await db
    .select({ lockedUntil: rateLimits.lockedUntil })
    .from(rateLimits)
    .where(eq(rateLimits.key, key));
  if (!row?.lockedUntil || row.lockedUntil <= now) return null;
  return row.lockedUntil;
}
