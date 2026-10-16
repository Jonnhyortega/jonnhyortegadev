import { createRemoteJWKSet, jwtVerify } from 'jose';
import { safeEqual } from '../lib/crypto.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// Cliente de Google OAuth (authorization code + PKCE). `jwks` y `fetch` se
// pueden inyectar en tests; por defecto se usa el JWKS remoto de Google
// (creado una sola vez por cliente, con caché propia de jose) y el fetch global.
export function createGoogleClient(env, { jwks, fetch: fetchImpl = globalThis.fetch } = {}) {
  const keySet = jwks ?? createRemoteJWKSet(new URL(JWKS_URL));

  function buildAuthUrl({ state, codeChallenge, nonce }) {
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: env.oauthRedirectUri,
      response_type: 'code',
      scope: 'openid email',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  // Intercambia el código por el id_token. Ante cualquier fallo lanza un
  // error genérico: nunca se propaga el cuerpo de la respuesta de Google.
  async function exchangeCode({ code, codeVerifier }) {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier: codeVerifier,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: env.oauthRedirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) throw new Error(`token exchange failed with status ${res.status}`);

    const data = await res.json().catch(() => null);
    if (typeof data?.id_token !== 'string' || data.id_token.length === 0) {
      throw new Error('token exchange returned no id_token');
    }
    return { idToken: data.id_token };
  }

  // Verifica firma (RS256), issuer, audience, expiración y nonce del id_token.
  async function verifyIdToken(idToken, { nonce } = {}) {
    const { payload } = await jwtVerify(idToken, keySet, {
      algorithms: ['RS256'],
      issuer: ISSUERS,
      audience: env.googleClientId,
    });
    if (!safeEqual(payload.nonce, nonce)) throw new Error('id_token nonce mismatch');
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('id_token without sub');
    }
    if (typeof payload.email !== 'string') throw new Error('id_token without email');

    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    };
  }

  return { buildAuthUrl, exchangeCode, verifyIdToken };
}
