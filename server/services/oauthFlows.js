import { createHash } from 'node:crypto';
import { eq, lte } from 'drizzle-orm';
import { serialize } from 'cookie';
import { oauthFlows } from '../db/schema.js';
import { randomToken, sha256 } from '../lib/crypto.js';

const FLOW_TTL_MS = 5 * 60_000;

// Cookie que liga el flujo al navegador que lo inició (RFC 9700 §4.7.1).
// SameSite=Lax: tiene que viajar en la redirección de primer nivel desde Google.
export const OAUTH_COOKIE = '__Host-oauth';
const oauthCookieAttributes = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

// Inicia un flujo OAuth: genera state, nonce, code_verifier (PKCE) y el valor
// de binding. En la BD solo se guardan los hashes de state y binding. De paso
// borra los flujos ya expirados.
export async function createFlow(db, now) {
  const state = randomToken(32);
  const codeVerifier = randomToken(32);
  const nonce = randomToken(32);
  const binding = randomToken(32);
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  await db.delete(oauthFlows).where(lte(oauthFlows.expiresAt, now));
  await db.insert(oauthFlows).values({
    stateHash: sha256(state),
    codeVerifier,
    nonce,
    bindingHash: sha256(binding),
    expiresAt: new Date(now.getTime() + FLOW_TTL_MS),
  });
  return { state, codeVerifier, nonce, binding, codeChallenge };
}

// Consume el flujo del state (un solo uso). null si no existe o expiró.
export async function takeFlow(db, { state, now }) {
  if (typeof state !== 'string' || state.length === 0) return null;

  const [flow] = await db
    .delete(oauthFlows)
    .where(eq(oauthFlows.stateHash, sha256(state)))
    .returning();
  if (!flow || flow.expiresAt.getTime() <= now.getTime()) return null;
  return { codeVerifier: flow.codeVerifier, nonce: flow.nonce, bindingHash: flow.bindingHash };
}

export function setFlowCookie(res, binding) {
  res.append(
    'Set-Cookie',
    serialize(OAUTH_COOKIE, binding, { ...oauthCookieAttributes, maxAge: FLOW_TTL_MS / 1000 }),
  );
}

export function clearFlowCookie(res) {
  res.append('Set-Cookie', serialize(OAUTH_COOKIE, '', { ...oauthCookieAttributes, maxAge: 0 }));
}
