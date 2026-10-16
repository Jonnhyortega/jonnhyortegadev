import { createHash } from 'node:crypto';
import { eq, lte } from 'drizzle-orm';
import { oauthFlows } from '../db/schema.js';
import { randomToken, sha256 } from '../lib/crypto.js';

const FLOW_TTL_MS = 5 * 60_000;

// Inicia un flujo OAuth: genera state, nonce y code_verifier (PKCE). En la BD
// solo se guarda el hash del state. De paso borra los flujos ya expirados.
export async function createFlow(db, now) {
  const state = randomToken(32);
  const codeVerifier = randomToken(32);
  const nonce = randomToken(32);
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  await db.delete(oauthFlows).where(lte(oauthFlows.expiresAt, now));
  await db.insert(oauthFlows).values({
    stateHash: sha256(state),
    codeVerifier,
    nonce,
    expiresAt: new Date(now.getTime() + FLOW_TTL_MS),
  });
  return { state, codeVerifier, nonce, codeChallenge };
}

// Consume el flujo del state (un solo uso). null si no existe o expiró.
export async function takeFlow(db, { state, now }) {
  if (typeof state !== 'string' || state.length === 0) return null;

  const [flow] = await db
    .delete(oauthFlows)
    .where(eq(oauthFlows.stateHash, sha256(state)))
    .returning();
  if (!flow || flow.expiresAt.getTime() <= now.getTime()) return null;
  return { codeVerifier: flow.codeVerifier, nonce: flow.nonce };
}
