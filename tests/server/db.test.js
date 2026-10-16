import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './helpers/db.js';
import { projects, translations, sessions } from '../../server/db/schema.js';

describe('esquema de base de datos', () => {
  let db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it('inserta y lee una fila de projects', async () => {
    const [created] = await db
      .insert(projects)
      .values({
        slug: 'demo',
        position: 0,
        title: 'Demo',
        descriptionEn: 'Demo project',
        descriptionEs: 'Proyecto demo',
        imageUrl: 'https://res.cloudinary.com/x/y.png',
        tech: ['React', 'Node'],
      })
      .returning();

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.version).toBe(0);

    const [found] = await db.select().from(projects).where(eq(projects.slug, 'demo'));
    expect(found.title).toBe('Demo');
    expect(found.tech).toEqual(['React', 'Node']);
  });

  it('rechaza translations con id distinto de 1', async () => {
    await expect(
      db.insert(translations).values({ id: 2, data: {}, version: 0 }),
    ).rejects.toThrow();
  });

  it('rechaza sessions.kind inválido', async () => {
    await expect(
      db.insert(sessions).values({
        tokenHash: 'h',
        csrfSecret: 's',
        kind: 'admin',
        expiresAt: new Date(Date.now() + 1000),
      }),
    ).rejects.toThrow();
  });
});

describe('aislamiento de createTestDb', () => {
  it('las bases de datos de test son independientes entre sí', async () => {
    const a = await createTestDb();
    const b = await createTestDb();
    await a.insert(projects).values({
      slug: 'solo-en-a',
      position: 0,
      title: 'A',
      descriptionEn: 'A',
      descriptionEs: 'A',
      imageUrl: 'https://res.cloudinary.com/x/y.png',
      tech: [],
    });
    expect(await a.select().from(projects)).toHaveLength(1);
    expect(await b.select().from(projects)).toHaveLength(0);
  });
});
