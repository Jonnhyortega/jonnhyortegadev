import { describe, it, expect } from 'vitest';
import { mergeContent } from '@/content/merge.js';

const defaults = {
  translations: {
    en: { hero: { title: 'Full Stack', subtitle: 'Sub' }, nav: { home: 'Home' } },
    es: { hero: { title: 'Desarrollador', subtitle: 'Sub es' }, nav: { home: 'Inicio' } },
  },
  projects: [
    { id: 'a', title: 'A', descriptionEn: 'a', descriptionEs: 'a', imageUrl: 'x', tech: ['react'], liveUrl: 'u', githubUrl: '' },
  ],
};

describe('mergeContent', () => {
  it('remote null devuelve los defaults', () => {
    const r = mergeContent(defaults, null);
    expect(r.translations).toEqual(defaults.translations);
    expect(r.projects).toEqual(defaults.projects);
    expect(r.theme).toBeNull();
  });

  it('solo cambia el texto remoto indicado', () => {
    const r = mergeContent(defaults, { translations: { en: { hero: { title: 'Nuevo' } } } });
    expect(r.translations.en.hero.title).toBe('Nuevo');
    expect(r.translations.en.hero.subtitle).toBe('Sub');
    expect(r.translations.es).toEqual(defaults.translations.es);
  });

  it('ignora claves desconocidas para los defaults', () => {
    const r = mergeContent(defaults, { translations: { en: { hero: { extra: 'x' }, otra: { a: 'b' } } } });
    expect(r.translations.en.hero).not.toHaveProperty('extra');
    expect(r.translations.en).not.toHaveProperty('otra');
  });

  it('un string vacío o no string deja el default', () => {
    const r = mergeContent(defaults, { translations: { en: { hero: { title: '', subtitle: 5 } } } });
    expect(r.translations.en.hero.title).toBe('Full Stack');
    expect(r.translations.en.hero.subtitle).toBe('Sub');
  });

  it('projects que no es array usa los defaults', () => {
    expect(mergeContent(defaults, { projects: 'x' }).projects).toEqual(defaults.projects);
    expect(mergeContent(defaults, { projects: [{ id: 1 }] }).projects).toEqual(defaults.projects);
  });

  it('projects válido reemplaza a los defaults', () => {
    const p = [{ id: 'z', title: 'Z', descriptionEn: 'e', descriptionEs: 's', imageUrl: 'i', tech: ['js'], liveUrl: 'l', githubUrl: null }];
    expect(mergeContent(defaults, { projects: p }).projects).toEqual(p);
  });

  it('theme: solo variables --c- con valor rgb válido', () => {
    const r = mergeContent(defaults, {
      theme: { colors: { primary: '#fff' }, vars: { '--c-purple-500': '1 2 3', '--x': '1 2 3', '--c-ink': 'red' } },
    });
    expect(r.theme.vars).toEqual({ '--c-purple-500': '1 2 3' });
  });
});
