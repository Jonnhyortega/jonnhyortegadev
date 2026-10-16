// Routing Middleware de Vercel: sirve el panel de administración solo por la ruta secreta.
import { rewrite } from '@vercel/functions';

export const config = { matcher: ['/((?!assets/|api/).*)'] };

export function handle(request, env) {
  const url = new URL(request.url);

  // El archivo del panel nunca se sirve por su nombre real.
  if (url.pathname === '/admin.html') {
    return new Response('Not Found', { status: 404 });
  }

  // Fuera de producción o sin ruta configurada, la ruta secreta no existe.
  if (env.VERCEL_ENV !== 'production' || !env.ADMIN_PATH) return undefined;

  if (url.pathname === env.ADMIN_PATH) {
    return rewrite(new URL('/admin.html', request.url), {
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Destino neutro del callback de OAuth: vuelve a la ruta secreta sin exponerla en la API.
  if (url.pathname === '/__panel-return') {
    const target = new URL(env.ADMIN_PATH, request.url);
    if (url.searchParams.get('error') === '1') target.searchParams.set('error', '1');
    return new Response(null, { status: 302, headers: { Location: target.toString() } });
  }

  return undefined;
}

export default function middleware(request) {
  return handle(request, process.env);
}
