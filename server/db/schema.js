import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  jsonb,
  timestamp,
  index,
  check,
} from 'drizzle-orm/pg-core';

const tz = (name) => timestamp(name, { withTimezone: true });
const createdAt = () => tz('created_at').notNull().defaultNow();
const updatedAt = () => tz('updated_at').notNull().defaultNow();

// Identidad del único administrador. google_sub se completa en el primer login.
export const adminIdentity = pgTable('admin_identity', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  googleSub: text('google_sub'),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull().unique(),
    csrfSecret: text('csrf_secret').notNull(),
    kind: text('kind').notNull(),
    createdAt: createdAt(),
    lastSeenAt: tz('last_seen_at').notNull().defaultNow(),
    expiresAt: tz('expires_at').notNull(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
  },
  (t) => [
    check('sessions_kind_check', sql`${t.kind} in ('full', 'recovery')`),
    index('sessions_expires_at_idx').on(t.expiresAt),
  ],
);

export const oauthFlows = pgTable('oauth_flows', {
  stateHash: text('state_hash').primaryKey(),
  codeVerifier: text('code_verifier').notNull(),
  nonce: text('nonce').notNull(),
  // sha256 del valor de la cookie __Host-oauth: liga el flujo al navegador.
  bindingHash: text('binding_hash').notNull(),
  expiresAt: tz('expires_at').notNull(),
});

export const recoveryCodes = pgTable(
  'recovery_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeHash: text('code_hash').notNull(),
    createdAt: createdAt(),
    usedAt: tz('used_at'),
  },
  (t) => [index('recovery_codes_used_at_idx').on(t.usedAt)],
);

export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: tz('window_start').notNull().defaultNow(),
  failures: integer('failures').notNull().default(0),
  lockedUntil: tz('locked_until'),
  // Para reiniciar failures tras 24 h sin fallos.
  lastFailureAt: tz('last_failure_at'),
});

// Fila única (id = 1) con los textos { en, es }.
export const translations = pgTable(
  'translations',
  {
    id: integer('id').primaryKey().default(1),
    data: jsonb('data').notNull(),
    version: integer('version').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [check('translations_single_row_check', sql`${t.id} = 1`)],
);

// Fila única (id = 1) con el tema.
export const theme = pgTable(
  'theme',
  {
    id: integer('id').primaryKey().default(1),
    data: jsonb('data').notNull(),
    version: integer('version').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [check('theme_single_row_check', sql`${t.id} = 1`)],
);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  position: integer('position').notNull().default(0),
  title: text('title').notNull(),
  descriptionEn: text('description_en').notNull().default(''),
  descriptionEs: text('description_es').notNull().default(''),
  imageUrl: text('image_url').notNull().default(''),
  tech: text('tech')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  liveUrl: text('live_url'),
  githubUrl: text('github_url'),
  published: boolean('published').notNull().default(true),
  version: integer('version').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Orden de escritura estable (los timestamps pueden repetirse).
    seq: bigint('seq', { mode: 'number' }).generatedAlwaysAsIdentity(),
    entity: text('entity').notNull(),
    data: jsonb('data').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'content_revisions_entity_check',
      sql`${t.entity} in ('translations', 'theme', 'projects')`,
    ),
    index('content_revisions_entity_created_at_idx').on(t.entity, t.createdAt),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event: text('event').notNull(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    meta: jsonb('meta'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_created_at_idx').on(t.createdAt)],
);
