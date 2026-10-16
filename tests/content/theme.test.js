import { describe, it, expect } from 'vitest';
import { deriveScale, themeToCssVars } from '@/content/theme.js';
import { DEFAULT_THEME } from '@/content/defaults.js';

const lum = (s) => { const [r, g, b] = s.split(' ').map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

describe('deriveScale', () => {
  it('500 es el color dado', () => {
    expect(deriveScale('#a855f7')['500']).toBe('168 85 247');
  });
  it('devuelve 11 claves', () => {
    expect(Object.keys(deriveScale('#a855f7'))).toHaveLength(11);
  });
  it('tonos claros tienen más luminancia que los oscuros', () => {
    const s = deriveScale('#a855f7');
    expect(lum(s['50'])).toBeGreaterThan(lum(s['500']));
    expect(lum(s['500'])).toBeGreaterThan(lum(s['950']));
  });
});

describe('themeToCssVars', () => {
  it('tema por defecto → {}', () => {
    expect(themeToCssVars(DEFAULT_THEME)).toEqual({});
  });
  it('solo incluye paletas modificadas', () => {
    const vars = themeToCssVars({ ...DEFAULT_THEME, primary: '#ff0000' });
    expect(vars['--c-purple-500']).toBe('255 0 0');
    expect(Object.keys(vars).some((k) => k.startsWith('--c-violet-'))).toBe(false);
  });
  it('ink genera --c-ink', () => {
    expect(themeToCssVars({ ...DEFAULT_THEME, ink: '#000000' })['--c-ink']).toBe('0 0 0');
  });
});
