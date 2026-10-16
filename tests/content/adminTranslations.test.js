import { describe, it, expect } from 'vitest';
import { flattenTranslations, unflattenTranslations, setPath } from '@/admin/lib/translations.js';
import { DEFAULT_TRANSLATIONS } from '@/content/defaults.js';

describe('flattenTranslations', () => {
  it('aplana a claves con puntos y columnas en/es', () => {
    const rows = flattenTranslations({
      en: { hero: { title: 'A' }, nav: { home: 'H' } },
      es: { hero: { title: 'B' }, nav: { home: 'I' } },
    });
    expect(rows).toEqual([
      { key: 'hero.title', en: 'A', es: 'B' },
      { key: 'nav.home', en: 'H', es: 'I' },
    ]);
  });

  it('soporta anidado profundo (chatbot.quickReplies.budget)', () => {
    const keys = flattenTranslations(DEFAULT_TRANSLATIONS).map((r) => r.key);
    expect(keys).toContain('chatbot.quickReplies.budget');
    expect(keys).toContain('hero.title');
  });

  it('usa cadena vacía si falta una clave en un idioma', () => {
    const rows = flattenTranslations({ en: { a: { b: 'x' } }, es: { a: {} } });
    expect(rows).toEqual([{ key: 'a.b', en: 'x', es: '' }]);
  });
});

describe('unflattenTranslations', () => {
  it('es la inversa de flattenTranslations', () => {
    const rows = flattenTranslations(DEFAULT_TRANSLATIONS);
    expect(unflattenTranslations(rows)).toEqual(DEFAULT_TRANSLATIONS);
  });
});

describe('setPath', () => {
  it('devuelve una copia con el valor cambiado, sin mutar', () => {
    const tree = { en: { hero: { title: 'A' } } };
    const next = setPath(tree, 'en.hero.title', 'Z');
    expect(next.en.hero.title).toBe('Z');
    expect(tree.en.hero.title).toBe('A');
  });
});
