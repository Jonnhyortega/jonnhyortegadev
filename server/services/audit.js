import { desc } from 'drizzle-orm';
import { auditLog } from '../db/schema.js';
import { hmacIp } from '../lib/crypto.js';

const SENSITIVE_KEY = /token|code|password|cookie|secret/i;

// Elimina recursivamente las claves que podrían contener credenciales.
function sanitizeMeta(value) {
  if (Array.isArray(value)) return value.map(sanitizeMeta);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, inner]) => [key, sanitizeMeta(inner)]),
    );
  }
  return value;
}

export async function recordAudit(db, { event, ipHash, userAgent, meta, now }) {
  await db.insert(auditLog).values({
    event,
    ipHash: ipHash ?? null,
    userAgent: userAgent ?? null,
    meta: meta ? sanitizeMeta(meta) : null,
    createdAt: now,
  });
}

export async function listAudit(db, { limit = 50 } = {}) {
  return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}

// Contexto de la petición sin guardar la IP en claro.
export function requestContext(req, env) {
  return {
    ipHash: hmacIp(env.ipHashSecret, req.ip ?? ''),
    userAgent: (req.get('user-agent') ?? '').slice(0, 300),
  };
}
