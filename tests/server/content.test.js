import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { buildTestApp } from './helpers/app.js';
import { seedContent } from '../../server/db/seed.js';
import { translations, theme, projects, contentRevisions } from '../../server/db/schema.js';
import { DEFAULT_PROJECTS, DEFAULT_THEME, DEFAULT_TRANSLATIONS } from '../../src/content/defaults.js';
import { VersionConflictError } from '../../server/lib/errors.js';
import {
  createProject,
  deleteProject,
  getEntity,
  listProjects,
  listRevisions,
  putTheme,
  putTranslations,
  reorderProjects,
  restoreRevision,
  updateProject,
} from '../../server/services/content.js';

const CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=600';

describe('GET /api/content', () => {
  it('tras el seed devuelve proyectos publicados en orden, con cabeceras de caché', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    await ctx.db.update(projects).set({ published: false }).where(eq(projects.slug, DEFAULT_PROJECTS[1].id));

    const res = await request(ctx.app).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe(CACHE);
    const expected = DEFAULT_PROJECTS.filter((p) => p.published && p.id !== DEFAULT_PROJECTS[1].id);
    expect(res.body.projects.map((p) => p.title)).toEqual(expected.map((p) => p.title));
    expect(Object.keys(res.body.projects[0]).sort()).toEqual([
      'descriptionEn',
      'descriptionEs',
      'githubUrl',
      'id',
      'imageUrl',
      'liveUrl',
      'tech',
      'title',
    ]);
    expect(res.body.translations).toEqual(DEFAULT_TRANSLATIONS);
    expect(res.body.theme).toEqual({ colors: DEFAULT_THEME, vars: {} });
  });

  it('sin seed devuelve null y lista vacía', async () => {
    const { app } = await buildTestApp();
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(200);
    expect(res.body.translations).toBeNull();
    expect(res.body.theme).toBeNull();
    expect(res.body.projects).toEqual([]);
  });

  it('tema personalizado produce vars', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    await ctx.db.update(theme).set({ data: { ...DEFAULT_THEME, primary: '#112233' } });
    const res = await request(ctx.app).get('/api/content');
    expect(res.body.theme.colors.primary).toBe('#112233');
    expect(res.body.theme.vars['--c-purple-500']).toBe('17 34 51');
  });

  it('503 con no-store si la BD falla', async () => {
    const db = {
      select() {
        throw new Error('boom');
      },
    };
    const { app } = await buildTestApp({ db });
    const res = await request(app).get('/api/content');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'unavailable' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('funciona fuera de producción', async () => {
    const ctx = await buildTestApp({ env: { isProduction: false, vercelEnv: 'development' } });
    const res = await request(ctx.app).get('/api/content');
    expect(res.status).toBe(200);
  });
});

describe('seedContent', () => {
  it('es idempotente', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    const snap = async () => ({
      t: await ctx.db.select().from(translations),
      h: await ctx.db.select().from(theme),
      p: (await ctx.db.select().from(projects)).map((r) => [r.id, r.slug, r.position]),
    });
    const a = await snap();
    await seedContent(ctx.db, ctx.clock.now());
    const b = await snap();
    expect(b).toEqual(a);
    expect(a.p).toHaveLength(DEFAULT_PROJECTS.length);
    expect(a.t[0].version).toBe(0);
  });
});

describe('servicio de escritura', () => {
  it('putTheme incrementa versión, detecta conflicto y poda a 30 revisiones', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    let version = 0;
    for (let i = 0; i < 32; i += 1) {
      ctx.clock.advance(1000);
      const res = await putTheme(ctx.db, {
        data: { ...DEFAULT_THEME, primary: `#0000${(i % 10).toString()}0` },
        version,
        now: ctx.clock.now(),
      });
      version = res.version;
    }
    expect(version).toBe(32);
    await expect(
      putTheme(ctx.db, { data: DEFAULT_THEME, version: 3, now: ctx.clock.now() }),
    ).rejects.toBeInstanceOf(VersionConflictError);
    expect(await listRevisions(ctx.db, 'theme')).toHaveLength(30);
  });

  it('proyectos: crear, actualizar con conflicto, reordenar, borrar y restaurar', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    const { id: _id, ...input } = DEFAULT_PROJECTS[0];
    const now = () => ctx.clock.now();

    const created = await createProject(ctx.db, { data: { ...input, title: 'Nuevo' }, now: now() });
    expect(created.position).toBe(DEFAULT_PROJECTS.length);

    ctx.clock.advance(1000);
    const updated = await updateProject(ctx.db, created.id, {
      data: { ...input, title: 'Editado' },
      version: 0,
      now: now(),
    });
    expect(updated.version).toBe(1);
    await expect(
      updateProject(ctx.db, created.id, { data: input, version: 0, now: now() }),
    ).rejects.toBeInstanceOf(VersionConflictError);

    ctx.clock.advance(1000);
    const ids = (await listProjects(ctx.db)).map((p) => p.id).reverse();
    const reordered = await reorderProjects(ctx.db, ids, { now: now() });
    expect(reordered.map((p) => p.id)).toEqual(ids);
    await expect(reorderProjects(ctx.db, ids.slice(1), { now: now() })).rejects.toMatchObject({
      status: 400,
    });

    ctx.clock.advance(1000);
    await deleteProject(ctx.db, created.id, { now: now() });
    expect(await listProjects(ctx.db)).toHaveLength(DEFAULT_PROJECTS.length);

    const revisions = await listRevisions(ctx.db, 'projects');
    expect(revisions).toHaveLength(4);
    // La más antigua contiene el proyecto recién creado.
    ctx.clock.advance(1000);
    const restored = await restoreRevision(ctx.db, { id: revisions[3].id, now: now() });
    expect(restored.data.some((p) => p.title === 'Nuevo')).toBe(true);
  });
});

describe('endurecimiento del servicio', () => {
  it('32 escrituras con el mismo now conservan las 30 más recientes por orden de escritura', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    const now = ctx.clock.now();
    let version = 0;
    for (let i = 0; i < 32; i += 1) {
      const hex = (i + 16).toString(16).padStart(2, '0');
      const res = await putTheme(ctx.db, {
        data: { ...DEFAULT_THEME, primary: `#0000${hex}` },
        version,
        now,
      });
      version = res.version;
    }
    const revs = await listRevisions(ctx.db, 'theme');
    expect(revs).toHaveLength(30);
    const rows = await ctx.db
      .select()
      .from(contentRevisions)
      .where(eq(contentRevisions.entity, 'theme'));
    const primaries = rows.map((r) => r.data.primary).sort();
    const expected = Array.from({ length: 30 }, (_, k) => `#0000${(k + 2 + 16).toString(16).padStart(2, '0')}`).sort();
    expect(primaries).toEqual(expected);
  });

  it('restoreRevision rechaza revisiones incompatibles sin escribir', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    const now = ctx.clock.now();
    const insert = async (entity, data) => {
      const [row] = await ctx.db.insert(contentRevisions).values({ entity, data, createdAt: now }).returning();
      return row.id;
    };
    const badTrans = await insert('translations', { en: { hack: 'x' }, es: {} });
    const badTheme = await insert('theme', { ...DEFAULT_THEME, primary: 'red' });
    const goodProjects = (await listProjects(ctx.db)).length;
    const badProjects = await insert('projects', [
      {
        id: '00000000-0000-4000-8000-000000000001',
        slug: 'x',
        position: 0,
        title: 'X',
        descriptionEn: 'a',
        descriptionEs: 'a',
        imageUrl: 'https://evil.com/x.png',
        tech: ['react'],
        liveUrl: null,
        githubUrl: null,
        published: true,
        version: 0,
      },
    ]);
    for (const id of [badTrans, badTheme, badProjects]) {
      await expect(restoreRevision(ctx.db, { id, now })).rejects.toMatchObject({
        status: 409,
        code: 'revision_incompatible',
      });
    }
    expect(await listProjects(ctx.db)).toHaveLength(goodProjects);
    expect((await getEntity(ctx.db, 'theme')).version).toBe(0);
    expect((await getEntity(ctx.db, 'translations')).data).toEqual(DEFAULT_TRANSLATIONS);
  });

  it('restaura translations y theme', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    ctx.clock.advance(1000);
    const t = structuredClone(DEFAULT_TRANSLATIONS);
    t.en.hero.title = 'Changed';
    await putTranslations(ctx.db, { data: t, version: 0, now: ctx.clock.now() });
    await putTheme(ctx.db, { data: { ...DEFAULT_THEME, primary: '#112233' }, version: 0, now: ctx.clock.now() });
    const [tRev] = await listRevisions(ctx.db, 'translations');
    const [hRev] = await listRevisions(ctx.db, 'theme');
    const a = await restoreRevision(ctx.db, { id: tRev.id, now: ctx.clock.now() });
    const b = await restoreRevision(ctx.db, { id: hRev.id, now: ctx.clock.now() });
    expect(a.version).toBe(2);
    expect(b.version).toBe(2);
    expect((await getEntity(ctx.db, 'translations')).data.en.hero.title).toBe('Changed');
  });

  it('restaurar proyectos deja posiciones, slugs y versiones esperados', async () => {
    const ctx = await buildTestApp();
    await seedContent(ctx.db, ctx.clock.now());
    const { id: _id, ...input } = DEFAULT_PROJECTS[0];
    const original = await listProjects(ctx.db);
    const extra = await createProject(ctx.db, { data: { ...input, title: 'Extra' }, now: ctx.clock.now() });
    const [snapRev] = await listRevisions(ctx.db, 'projects'); // incluye Extra
    await deleteProject(ctx.db, extra.id, { now: ctx.clock.now() });
    const first = original[0];
    await updateProject(ctx.db, first.id, { data: { ...input, title: 'Cambiado' }, version: 0, now: ctx.clock.now() });
    await restoreRevision(ctx.db, { id: snapRev.id, now: ctx.clock.now() });
    const after = await listProjects(ctx.db);
    expect(after.map((p) => p.id)).toEqual([...original.map((p) => p.id), extra.id]);
    expect(after.map((p) => p.position)).toEqual(after.map((_, i) => i));
    expect(after[0].title).toBe(DEFAULT_PROJECTS[0].title);
    expect(after[0].version).toBe(2); // 0 -> update 1 -> restore 2
    const rows = await ctx.db.select().from(projects);
    expect(rows.find((r) => r.id === first.id).slug).toBe(DEFAULT_PROJECTS[0].id);
    expect(rows.find((r) => r.id === extra.id).slug).toMatch(/^extra-/);
  });
});
