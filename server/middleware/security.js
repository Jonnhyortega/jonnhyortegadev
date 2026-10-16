import helmet from 'helmet';

// Cabeceras de seguridad para la API: solo devuelve JSON, así que la CSP
// es lo más restrictiva posible.
export function security() {
  return helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
}
