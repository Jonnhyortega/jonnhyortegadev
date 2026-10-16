import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { contentRevisions, projects, theme, translations } from '../db/schema.js';
import { HttpError, NotFoundError, VersionConflictError } from '../lib/errors.js';
import { themeToCssVars } from '../../src/content/theme.js';

const MAX_REVISIONS = 30;
const SINGLETONS = { translations, theme };

const toPublicProject = (row) => ({
  id: row.id,
  title: row.title,
  descriptionEn: row.descriptionEn,
  descriptionEs: row.descriptionEs,
  imageUrl: row.imageUrl,
  tech: row.tech,
  liveUrl: row.liveUrl,
  githubUrl: row.githubUrl,
});

// Vista de administración: lo público más posición, versión y estado.
const toAdminProject = (row) => ({
  ...toPublicProject(row),
  position: row.position,
  version: row.version,
  published: row.published,
});

const orderedProjects = (executor) =>
  executor.select().from(projects).orderBy(asc(projects.position), asc(projects.createdAt));

// Contenido público: solo proyectos publicados, ordenados por posición.
// Si falta una fila devuelve null y el front mezcla con los valores por defecto.
export async function getPublicContent(db) {
  const [tRows, thRows, pRows] = await Promise.all([
    db.select().from(translations).where(eq(translations.id, 1)),
    db.select().from(theme).where(eq(theme.id, 1)),
    db
      .select()
      .from(projects)
      .where(eq(projects.published, true))
      .orderBy(asc(projects.position), asc(projects.createdAt)),
  ]);
  const colors = thRows[0]?.data ?? null;
  return {
    translations: tRows[0]?.data ?? null,
    projects: pRows.map(toPublicProject),
    theme: colors ? { colors, vars: themeToCssVars(colors) } : null,
  };
}

export async function listProjects(db) {
  return (await orderedProjects(db)).map(toAdminProject);
}

export async function getEntity(db, entity) {
  if (entity === 'projects') return { data: await listProjects(db) };
  const table = SINGLETONS[entity];
  if (!table) throw new NotFoundError();
  const [row] = await db.select().from(table).where(eq(table.id, 1));
  return row ? { data: row.data, version: row.version } : null;
}

// Foto completa de los proyectos, tal como se guarda en una revisión.
async function projectsSnapshot(tx) {
  return (await orderedProjects(tx)).map((row) => ({
    id: row.id,
    slug: row.slug,
    position: row.position,
    title: row.title,
    descriptionEn: row.descriptionEn,
    descriptionEs: row.descriptionEs,
    imageUrl: row.imageUrl,
    tech: row.tech,
    liveUrl: row.liveUrl,
    githubUrl: row.githubUrl,
    published: row.published,
    version: row.version,
  }));
}

// Inserta la revisión y conserva solo las 30 más recientes de la entidad.
async function addRevision(tx, entity, data, now) {
  await tx.insert(contentRevisions).values({ entity, data, createdAt: now });
  const stale = await tx
    .select({ id: contentRevisions.id })
    .from(contentRevisions)
    .where(eq(contentRevisions.entity, entity))
    .orderBy(desc(contentRevisions.createdAt), desc(contentRevisions.id))
    .offset(MAX_REVISIONS);
  if (stale.length > 0) {
    await tx.delete(contentRevisions).where(
      inArray(
        contentRevisions.id,
        stale.map((r) => r.id),
      ),
    );
  }
}

async function writeSingleton(db, entity, { data, version, now }) {
  const table = SINGLETONS[entity];
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(table)
      .set({ data, version: sql`${table.version} + 1`, updatedAt: now })
      .where(and(eq(table.id, 1), eq(table.version, version)))
      .returning({ version: table.version });
    if (rows.length === 0) throw new VersionConflictError();
    await addRevision(tx, entity, data, now);
    return { data, version: rows[0].version };
  });
}

export const putTranslations = (db, args) => writeSingleton(db, 'translations', args);
export const putTheme = (db, args) => writeSingleton(db, 'theme', args);

function slugFor(title) {
  const base =
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'proyecto';
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function createProject(db, { data, now }) {
  const slug = slugFor(data.title);
  return db.transaction(async (tx) => {
    const [{ next }] = await tx
      .select({ next: sql`coalesce(max(${projects.position}), -1) + 1`.mapWith(Number) })
      .from(projects);
    const [row] = await tx
      .insert(projects)
      .values({ ...data, slug, position: next, createdAt: now, updatedAt: now })
      .returning();
    await addRevision(tx, 'projects', await projectsSnapshot(tx), now);
    return toAdminProject(row);
  });
}

export async function updateProject(db, id, { data, version, now }) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(projects)
      .set({ ...data, version: sql`${projects.version} + 1`, updatedAt: now })
      .where(and(eq(projects.id, id), eq(projects.version, version)))
      .returning();
    if (rows.length === 0) {
      const [exists] = await tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, id));
      throw exists ? new VersionConflictError() : new NotFoundError();
    }
    await addRevision(tx, 'projects', await projectsSnapshot(tx), now);
    return toAdminProject(rows[0]);
  });
}

export async function deleteProject(db, id, { now = new Date() } = {}) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });
    if (rows.length === 0) throw new NotFoundError();
    await addRevision(tx, 'projects', await projectsSnapshot(tx), now);
  });
}

// `ids` debe contener exactamente todos los proyectos, en el nuevo orden.
export async function reorderProjects(db, ids, { now = new Date() } = {}) {
  return db.transaction(async (tx) => {
    const current = await tx.select({ id: projects.id }).from(projects);
    const same =
      new Set(ids).size === ids.length &&
      ids.length === current.length &&
      current.every((row) => ids.includes(row.id));
    if (!same) throw new HttpError(400, 'invalid_order');
    for (const [position, id] of ids.entries()) {
      await tx
        .update(projects)
        .set({ position, version: sql`${projects.version} + 1`, updatedAt: now })
        .where(eq(projects.id, id));
    }
    await addRevision(tx, 'projects', await projectsSnapshot(tx), now);
    return (await orderedProjects(tx)).map(toAdminProject);
  });
}

export async function listRevisions(db, entity) {
  if (entity !== 'translations' && entity !== 'theme' && entity !== 'projects') {
    throw new NotFoundError();
  }
  return db
    .select({
      id: contentRevisions.id,
      entity: contentRevisions.entity,
      createdAt: contentRevisions.createdAt,
    })
    .from(contentRevisions)
    .where(eq(contentRevisions.entity, entity))
    .orderBy(desc(contentRevisions.createdAt), desc(contentRevisions.id));
}

// Restaura una revisión como una escritura nueva: incrementa versión y deja
// su propia revisión.
export async function restoreRevision(db, { id, now }) {
  return db.transaction(async (tx) => {
    const [revision] = await tx.select().from(contentRevisions).where(eq(contentRevisions.id, id));
    if (!revision) throw new NotFoundError();

    if (revision.entity === 'projects') {
      const snapshot = revision.data;
      const keep = snapshot.map((p) => p.id);
      await (keep.length > 0
        ? tx.delete(projects).where(notInArray(projects.id, keep))
        : tx.delete(projects));
      for (const p of snapshot) {
        const { id: projectId, version: _version, ...fields } = p;
        const updated = await tx
          .update(projects)
          .set({ ...fields, version: sql`${projects.version} + 1`, updatedAt: now })
          .where(eq(projects.id, projectId))
          .returning({ id: projects.id });
        if (updated.length === 0) {
          await tx
            .insert(projects)
            .values({ id: projectId, ...fields, version: 0, createdAt: now, updatedAt: now });
        }
      }
      await addRevision(tx, 'projects', await projectsSnapshot(tx), now);
      return { entity: 'projects', data: (await orderedProjects(tx)).map(toAdminProject) };
    }

    const table = SINGLETONS[revision.entity];
    const rows = await tx
      .update(table)
      .set({ data: revision.data, version: sql`${table.version} + 1`, updatedAt: now })
      .where(eq(table.id, 1))
      .returning({ version: table.version });
    if (rows.length === 0) throw new NotFoundError();
    await addRevision(tx, revision.entity, revision.data, now);
    return { entity: revision.entity, data: revision.data, version: rows[0].version };
  });
}
