import { describe, it, expect } from 'vitest';
import { DEFAULT_TRANSLATIONS, DEFAULT_THEME, DEFAULT_PROJECTS } from '../../src/content/defaults.js';
import { translationsSchema } from '../../server/schemas/translations.js';
import { themeSchema } from '../../server/schemas/theme.js';
import { projectInputSchema, withVersion, IMAGE_HOSTS } from '../../server/schemas/projects.js';

const clone = (v) => structuredClone(v);

describe('translationsSchema', () => {
  it('acepta los textos por defecto', () => {
    expect(translationsSchema.safeParse(DEFAULT_TRANSLATIONS).success).toBe(true);
  });
  it('rechaza claves desconocidas', () => {
    const t = clone(DEFAULT_TRANSLATIONS);
    t.en.hero.hack = 'x';
    expect(translationsSchema.safeParse(t).success).toBe(false);
  });
  it('rechaza vacío, más de 500 caracteres y caracteres de control', () => {
    for (const bad of ['', 'a'.repeat(501), 'hola\u0000mundo']) {
      const t = clone(DEFAULT_TRANSLATIONS);
      t.es.hero.title = bad;
      expect(translationsSchema.safeParse(t).success).toBe(false);
    }
  });
  it('acepta unicode y emojis', () => {
    const t = clone(DEFAULT_TRANSLATIONS);
    t.es.hero.title = 'Hola 👋 ñandú';
    expect(translationsSchema.safeParse(t).success).toBe(true);
  });
});

describe('themeSchema', () => {
  it('acepta el tema por defecto', () => {
    expect(themeSchema.safeParse(DEFAULT_THEME).success).toBe(true);
  });
  it('rechaza colores inválidos', () => {
    for (const bad of ['red', '#fff', '#ffffff; background:url(x)']) {
      expect(themeSchema.safeParse({ ...DEFAULT_THEME, primary: bad }).success).toBe(false);
    }
  });
  it('rechaza claves extra', () => {
    expect(themeSchema.safeParse({ ...DEFAULT_THEME, extra: '#ffffff' }).success).toBe(false);
  });
});

describe('projectInputSchema', () => {
  const { id: _id, ...base } = DEFAULT_PROJECTS[0];
  const ok = (over = {}) => projectInputSchema.safeParse({ ...base, ...over });

  it('acepta un proyecto por defecto', () => {
    expect(ok().success).toBe(true);
    expect(IMAGE_HOSTS).toEqual(['res.cloudinary.com', 'upload.wikimedia.org']);
  });
  it('rechaza imageUrl peligrosas', () => {
    for (const bad of [
      'javascript:alert(1)',
      'http://res.cloudinary.com/x.png',
      'https://evil.com/x.png',
      'https://res.cloudinary.com.evil.com/x.png',
      'https://user:pw@res.cloudinary.com/x.png',
      'https://res.cloudinary.com:8443/x.png',
    ]) {
      expect(ok({ imageUrl: bad }).success).toBe(false);
    }
  });
  it('liveUrl/githubUrl: https o null', () => {
    expect(ok({ liveUrl: null, githubUrl: null }).success).toBe(true);
    expect(ok({ liveUrl: 'http://x.com' }).success).toBe(false);
    expect(ok({ githubUrl: 'javascript:alert(1)' }).success).toBe(false);
    expect(ok({ liveUrl: 'https://u:p@x.com' }).success).toBe(false);
  });
  it('tech: sin duplicados y solo claves conocidas', () => {
    expect(ok({ tech: ['react', 'react'] }).success).toBe(false);
    expect(ok({ tech: ['php'] }).success).toBe(false);
    expect(ok({ tech: [] }).success).toBe(false);
  });
  it('rechaza claves extra y título largo', () => {
    expect(ok({ slug: 'x' }).success).toBe(false);
    expect(ok({ title: 'a'.repeat(81) }).success).toBe(false);
  });
});

describe('withVersion', () => {
  const s = withVersion(projectInputSchema);
  const { id: _id, ...base } = DEFAULT_PROJECTS[0];
  it('exige version entera no negativa', () => {
    expect(s.safeParse({ data: base, version: 0 }).success).toBe(true);
    expect(s.safeParse({ data: base, version: -1 }).success).toBe(false);
    expect(s.safeParse({ data: base, version: 1.5 }).success).toBe(false);
    expect(s.safeParse({ data: base }).success).toBe(false);
    expect(s.safeParse({ data: base, version: 0, x: 1 }).success).toBe(false);
  });
});

describe('endurecimiento de URLs y textos de proyecto', () => {
  const { id: _id, ...base } = DEFAULT_PROJECTS[0];
  const parse = (over) => projectInputSchema.safeParse({ ...base, ...over });

  it('rechaza espacios, backslashes y control antes de parsear', () => {
    for (const bad of [
      'https:\\\\res.cloudinary.com\\x',
      'https://res.cloudinary.com\\@evil.com/x',
      'https://res.cloud\ninary.com/x',
      '  https://res.cloudinary.com/x',
      'https://res.cloudinary.com/a\tb',
    ]) {
      expect(parse({ imageUrl: bad }).success).toBe(false);
      expect(parse({ liveUrl: bad.replace('res.cloudinary.com', 'x.com') }).success).toBe(false);
      expect(parse({ githubUrl: bad.replace('res.cloudinary.com', 'x.com') }).success).toBe(false);
    }
  });

  it('persiste la forma canónica', () => {
    const r = parse({
      imageUrl: 'https://RES.cloudinary.com/a.png',
      liveUrl: 'https://EXAMPLE.com',
    });
    expect(r.success).toBe(true);
    expect(r.data.imageUrl).toBe('https://res.cloudinary.com/a.png');
    expect(r.data.liveUrl).toBe('https://example.com/');
  });

  it('rechaza caracteres de control en título y descripciones', () => {
    expect(parse({ title: 'a\u0000b' }).success).toBe(false);
    expect(parse({ descriptionEn: 'a\u0007b' }).success).toBe(false);
    expect(parse({ descriptionEs: 'a\u007Fb' }).success).toBe(false);
  });
});
