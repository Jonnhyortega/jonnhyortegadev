import { randomBytes, randomInt } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { hash, verify } from '@node-rs/argon2';
import { recoveryCodes } from '../db/schema.js';

// Base32 de Crockford (sin I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12;
const CODE_COUNT = 10;
const NORMALIZED = /^[0-9A-HJKMNP-TV-Z]{12}$/;

// `Algorithm` es un const enum de TypeScript: en runtime el objeto exportado
// está vacío, así que se usa el valor numérico (Argon2id = 2).
const ARGON2ID = 2;
const HASH_OPTIONS = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 };

// Clave fija del advisory lock que serializa las regeneraciones.
// Número (no BigInt) para que cualquier driver lo serialice; se castea a bigint.
const REGENERATE_LOCK_ID = 7_310_420_001;

// Hash de relleno (mismos parámetros, secreto aleatorio que nunca coincide)
// para que cada verificación haga siempre CODE_COUNT verify. Se calcula una vez.
let dummyHashPromise = null;
function dummyHash() {
  dummyHashPromise ??= hash(randomBytes(32).toString('hex'), HASH_OPTIONS);
  return dummyHashPromise;
}

// Mayúsculas, sin guiones ni espacios, O→0 e I/L→1. '' si el resultado no
// son 12 caracteres Crockford.
export function normalizeCode(input) {
  if (typeof input !== 'string') return '';
  const normalized = input
    .toUpperCase()
    .replace(/[-\s]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  return NORMALIZED.test(normalized) ? normalized : '';
}

// randomInt no tiene sesgo de módulo.
function randomCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

const display = (code) => code.match(/.{4}/g).join('-');

// Sustituye todos los códigos por 10 nuevos. Devuelve los códigos en claro
// (única vez que existen fuera de la memoria); la BD solo guarda su hash.
export async function generateRecoveryCodes(db, now) {
  const codes = new Set();
  while (codes.size < CODE_COUNT) codes.add(randomCode());
  const plain = [...codes];
  const hashes = await Promise.all(plain.map((code) => hash(code, HASH_OPTIONS)));

  await db.transaction(async (tx) => {
    // Dos regeneraciones concurrentes no pueden dejar 20 códigos vivos.
    await tx.execute(sql`select pg_advisory_xact_lock(${REGENERATE_LOCK_ID}::bigint)`);
    await tx.delete(recoveryCodes);
    await tx.insert(recoveryCodes).values(hashes.map((codeHash) => ({ codeHash, createdAt: now })));
  });
  return plain.map(display);
}

// Verifica contra TODOS los códigos sin usar, rellenando con un hash ficticio
// hasta CODE_COUNT: el trabajo es constante sea cual sea el que coincide y
// cuántos queden. Después marca el código usado; el UPDATE condicional
// garantiza que, con peticiones concurrentes, solo una gane.
export async function consumeRecoveryCode(db, { code, now }) {
  const normalized = normalizeCode(code);
  if (!normalized) return false;

  const unused = await db
    .select({ id: recoveryCodes.id, codeHash: recoveryCodes.codeHash })
    .from(recoveryCodes)
    .where(isNull(recoveryCodes.usedAt));

  const candidates = [...unused];
  if (candidates.length < CODE_COUNT) {
    const padding = await dummyHash();
    while (candidates.length < CODE_COUNT) candidates.push({ id: null, codeHash: padding });
  }

  let matchId = null;
  for (const row of candidates) {
    const matches = await verify(row.codeHash, normalized);
    if (matches && matchId === null && row.id !== null) matchId = row.id;
  }
  if (matchId === null) return false;

  const updated = await db
    .update(recoveryCodes)
    .set({ usedAt: now })
    .where(and(eq(recoveryCodes.id, matchId), isNull(recoveryCodes.usedAt)))
    .returning({ id: recoveryCodes.id });
  return updated.length === 1;
}
