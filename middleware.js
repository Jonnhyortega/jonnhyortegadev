// Routing Middleware de Vercel: sirve el panel de administración solo por la ruta secreta.
import { rewrite } from '@vercel/functions';

export const config = { matcher: ['/((?!assets/|api/).*)'] };

const PANEL_RETURN_COOKIE = '__Host-panel-return';

// Normaliza para comparar con admin.html: decodifica, colapsa "/", minúsculas y sin "/" final.
// Devuelve null si la codificación es inválida.
function normalizePath(pathname) {
  try {
    return decodeURIComponent(pathname).replace(/\/{2,}/g, '/').toLowerCase().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function hasCookie(request, name) {
  const header = request.headers.get('cookie') ?? '';
  return header.split(';').some((part) => part.trim().startsWith(`${name}=`));
}

export function handle(request, env) {
  const url = new URL(request.url);

  // El archivo del panel nunca se sirve por su nombre real, ni con variantes de escritura.
  const normalized = normalizePath(url.pathname);
  if (normalized === null || normalized.endsWith('admin.html')) {
    return new Response('Not Found', { status: 404 });
  }

  // Fuera de producción o sin ruta configurada, la ruta secreta no existe.
  if (env.VERCEL_ENV !== 'production' || !env.ADMIN_PATH) return undefined;

  // La ruta secreta se compara tal cual, sin normalizar.
  if (url.pathname === env.ADMIN_PATH) {
    return rewrite(new URL('/admin.html', request.url), {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Destino neutro del callback de OAuth. Solo revela la ruta del panel a quien trae la
  // cookie de un solo uso que fija el callback; sin ella la ruta no existe.
  if (url.pathname === '/__panel-return' && hasCookie(request, PANEL_RETURN_COOKIE)) {
    const target = new URL(env.ADMIN_PATH, request.url);
    if (url.searchParams.get('error') === '1') target.searchParams.set('error', '1');
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

export default function middleware(request) {
  return handle(request, process.env);
}
