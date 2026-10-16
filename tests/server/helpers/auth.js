import { createSession, SESSION_COOKIE } from '../../../server/services/sessions.js';

// Crea una sesión directamente con el servicio (sin pasar por OAuth).
// Los tests envían `Cookie` y `Origin` manualmente.
export async function loginAs(ctx, kind = 'full') {
  const { token, csrfToken } = await createSession(ctx.db, {
    kind,
    ipHash: null,
    userAgent: null,
    now: ctx.clock.now(),
  });
  return { cookie: `${SESSION_COOKIE}=${token}`, csrf: csrfToken, token };
}
