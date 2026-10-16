import { eq, sql } from 'drizzle-orm';
import { rateLimits } from '../db/schema.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const ts = (date) => sql`${date.toISOString()}::timestamptz`;
const ms = (value) => sql`(${value}::double precision * interval '1 millisecond')`;

// Ventana fija con upsert atómico: una sola sentencia incrementa o reinicia.
export async function consume(db, { key, limit, windowMs, now }) {
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

  if (row.count <= limit) return { allowed: true, retryAfterMs: 0 };
  const retryAfterMs = row.windowStart.getTime() + windowMs - now.getTime();
  return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
}

// Cuenta un fallo y fija el bloqueo según la escala 10 -> 15 min, 15 -> 1 h, 20 -> 24 h.
// Los fallos se reinician si pasaron 24 h desde el último.
export async function registerFailure(db, { key, now }) {
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
    })
    .returning({ lockedUntil: rateLimits.lockedUntil });
  return { lockedUntil: row.lockedUntil ?? null };
}

export async function getLock(db, { key, now }) {
  const [row] = await db
    .select({ lockedUntil: rateLimits.lockedUntil })
    .from(rateLimits)
    .where(eq(rateLimits.key, key));
  if (!row?.lockedUntil || row.lockedUntil <= now) return null;
  return row.lockedUntil;
}
