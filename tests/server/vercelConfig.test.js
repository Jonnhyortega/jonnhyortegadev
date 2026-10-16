import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const config = JSON.parse(read('vercel.json'));

const headersFor = (source) => {
  const entry = config.headers.find((h) => h.source === source);
  expect(entry, `falta el bloque de headers para ${source}`).toBeDefined();
  return Object.fromEntries(entry.headers.map((h) => [h.key, h.value]));
};

const cspDirectives = (csp) =>
  Object.fromEntries(
    csp
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values];
      }),
  );

// Script inline de gtag: el que no tiene src ni type.
const inlineGtagScript = () => {
  const html = read('index.html');
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  expect(matches).toHaveLength(1);
  return matches[0][1];
};

describe('vercel.json', () => {
  it('conserva el rewrite de la API', () => {
    expect(config.rewrites).toEqual([{ source: '/api/(.*)', destination: '/api' }]);
  });

  it('no agrega un catch-all de SPA', () => {
    expect(config.rewrites.some((r) => r.destination === '/index.html')).toBe(false);
  });

  describe('headers de seguridad globales', () => {
    const headers = headersFor('/(.*)');

    it('define los headers fijos', () => {
      expect(headers['Strict-Transport-Security']).toBe(
        'max-age=63072000; includeSubDomains; preload',
      );
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Referrer-Policy']).toBeTruthy();
      expect(headers['Permissions-Policy']).toBe(
        'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      );
      expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('no envía una CSP que choque con la de la API', () => {
      expect(headers['Content-Security-Policy']).toBeUndefined();
    });
  });

  describe('CSP del sitio estático', () => {
    const source = '/((?!api/).*)';
    const csp = headersFor(source)['Content-Security-Policy'];
    const directives = cspDirectives(csp ?? '');

    it('existe y excluye /api', () => {
      expect(csp).toBeTruthy();
    });

    it('script-src es estricta', () => {
      const scriptSrc = directives['script-src'];
      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).toContain('https://www.googletagmanager.com');
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it('contiene frame-ancestors none y default-src self', () => {
      expect(directives['frame-ancestors']).toEqual(["'none'"]);
      expect(directives['default-src']).toEqual(["'self'"]);
    });

    it('el hash sha256 coincide con el script inline de gtag en index.html', () => {
      const hash = createHash('sha256').update(inlineGtagScript()).digest('base64');
      expect(directives['script-src']).toContain(`'sha256-${hash}'`);
    });

    it('permite los orígenes necesarios', () => {
      expect(directives['connect-src']).toEqual(
        expect.arrayContaining([
          "'self'",
          'https://2j5uuy7hcg.execute-api.us-east-1.amazonaws.com',
          'https://*.google-analytics.com',
          'https://*.analytics.google.com',
          'https://www.googletagmanager.com',
        ]),
      );
      expect(directives['img-src']).toEqual(
        expect.arrayContaining([
          "'self'",
          'data:',
          'blob:',
          'https://res.cloudinary.com',
          'https://upload.wikimedia.org',
          'https://*.google-analytics.com',
          'https://www.googletagmanager.com',
        ]),
      );
      expect(directives['form-action']).toEqual(["'self'", 'https://accounts.google.com']);
      expect(directives['media-src']).toEqual(["'self'"]);
      expect(directives['worker-src']).toEqual(["'self'", 'blob:']);
      expect(directives['font-src']).toContain('https://fonts.gstatic.com');
      expect(directives['style-src']).toContain('https://fonts.googleapis.com');
    });
  });

  it('los assets con hash se cachean como inmutables', () => {
    expect(headersFor('/assets/(.*)')['Cache-Control']).toBe(
      'public, max-age=31536000, immutable',
    );
  });
});
