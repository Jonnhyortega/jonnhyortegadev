import { describe, it, expect } from 'vitest';
import { DEFAULT_TRANSLATIONS, DEFAULT_PROJECTS, TECH_KEYS } from '@/content/defaults.js';

const collectKeys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? collectKeys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  ).sort();

describe('DEFAULT_TRANSLATIONS', () => {
  it('en y es tienen las mismas claves', () => {
    expect(collectKeys(DEFAULT_TRANSLATIONS.en)).toEqual(collectKeys(DEFAULT_TRANSLATIONS.es));
  });
  it('no incluye projects.*.description', () => {
    for (const lang of ['en', 'es']) {
      expect(collectKeys(DEFAULT_TRANSLATIONS[lang]).filter((k) => /^projects\..+\.description$/.test(k))).toEqual([]);
    }
  });
  it('conserva projects.title/subtitle/live/code', () => {
    for (const lang of ['en', 'es']) {
      const keys = collectKeys(DEFAULT_TRANSLATIONS[lang]);
      for (const k of ['title', 'subtitle', 'live', 'code']) expect(keys).toContain(`projects.${k}`);
    }
  });
});

describe('DEFAULT_PROJECTS', () => {
  it('tech es subconjunto de TECH_KEYS', () => {
    for (const p of DEFAULT_PROJECTS) for (const t of p.tech) expect(TECH_KEYS).toContain(t);
  });
  it('ids únicos y descripciones presentes', () => {
    const ids = DEFAULT_PROJECTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of DEFAULT_PROJECTS) {
      expect(p.descriptionEn).toBeTruthy();
      expect(p.descriptionEs).toBeTruthy();
      expect(p.published).toBe(true);
    }
  });
});
