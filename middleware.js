// Routing Middleware de Vercel: sirve el panel de administración solo por la ruta secreta.
import { rewrite } from '@vercel/functions';
import { verifyPanelReturn } from './server/lib/panelReturn.js';

export const config = { matcher: ['/((?!assets/|api/).*)'] };

const PANEL_RETURN_COOKIE = '__Host-panel-return';

// Formato admitido de ADMIN_PATH: "/" y 8 o más caracteres [A-Za-z0-9_-], sin chocar con
// /api ni /assets. Un valor fuera de formato se ignora por completo (falla cerrado).
function isValidAdminPath(path) {
  return (
    typeof path === 'string' && /^\/[A-Za-z0-9_-]{8,}$/.test(path) && !/^\/(api|assets)/i.test(path)
  );
}

// Host canónico (el de APP_ORIGIN), o null si no está definido o no es una URL.
function canonicalHost(appOrigin) {
  if (!appOrigin) return null;
  try {
    return new URL(appOrigin).host;
  } catch {
    return null;
  }
}

// Normaliza para comparar con admin.html: decodifica, colapsa "/", minúsculas y sin "/" final.
// Devuelve null si la codificación es inválida.
function normalizePath(pathname) {
  try {
    return decodeURIComponent(pathname).replace(/\/{2,}/g, '/').toLowerCase().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1);
  }
  return null;
}

export async function handle(request, env) {
  const url = new URL(request.url);

  // El archivo del panel nunca se sirve por su nombre real, ni con variantes de escritura.
  const normalized = normalizePath(url.pathname);
  if (normalized === null || normalized.endsWith('admin.html')) {
    return new Response('Not Found', { status: 404 });
  }

  // Fuera de producción, sin ruta configurada o con una ruta mal formada, la ruta secreta
  // no existe.
  if (env.VERCEL_ENV !== 'production' || !isValidAdminPath(env.ADMIN_PATH)) return undefined;

  // La ruta secreta se compara tal cual, sin normalizar.
  if (url.pathname === env.ADMIN_PATH) {
    // Fuera del host canónico (p. ej. el apex sin www) se redirige a APP_ORIGIN: las
    // cookies __Host- y la comprobación de Origin solo valen en ese host.
    const host = canonicalHost(env.APP_ORIGIN);
    if (host && url.host !== host) {
      const target = new URL(`${url.pathname}${url.search}`, env.APP_ORIGIN);
      return new Response(null, {
        status: 308,
        headers: { Location: target.toString(), 'Cache-Control': 'no-store' },
      });
    }
    return rewrite(new URL('/admin.html', request.url), {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Destino neutro del callback de OAuth. Solo revela la ruta del panel a quien trae la
  // cookie firmada que el callback fija únicamente tras un login correcto (R37); sin ella
  // la ruta no existe.
  if (
    url.pathname === '/__panel-return' &&
    (await verifyPanelReturn(
      env.PANEL_RETURN_SECRET,
      readCookie(request, PANEL_RETURN_COOKIE),
      Date.now(),
    ))
  ) {
    const target = new URL(env.ADMIN_PATH, request.url);
    return new Response(null, {
      status: 302,
      headers: {
        Location: target.toString(),
        'Set-Cookie': `${PANEL_RETURN_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return undefined;
}

export default async function middleware(request) {
  return handle(request, process.env);
}
