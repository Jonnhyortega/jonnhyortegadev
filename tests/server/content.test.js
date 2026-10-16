import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { buildTestApp } from './helpers/app.js';
import { seedContent } from '../../server/db/seed.js';
import { translations, theme, projects } from '../../server/db/schema.js';
import { DEFAULT_PROJECTS, DEFAULT_THEME, DEFAULT_TRANSLATIONS } from '../../src/content/defaults.js';
import { VersionConflictError } from '../../server/lib/errors.js';
import {
  createProject,
  deleteProject,
  listProjects,
  listRevisions,
  putTheme,
  reorderProjects,
  restoreRevision,
  updateProject,
} from '../../server/services/content.js';

const CACHE = 'public, s-maxage=60, stale-while-revalidate=600';

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
