import { z } from 'zod';

const nonEmpty = z.string().min(1);

const schema = z.object({
  DATABASE_URL: nonEmpty,
  GOOGLE_CLIENT_ID: nonEmpty,
  GOOGLE_CLIENT_SECRET: nonEmpty,
  OAUTH_REDIRECT_URI: z.string().url(),
  ADMIN_EMAIL: z.string().trim().email().toLowerCase(),
  APP_ORIGIN: z.string().url(),
  IP_HASH_SECRET: z.string().min(32),
  VERCEL_ENV: z.enum(['production', 'preview', 'development']).default('development'),
});

// Valida y normaliza las variables de entorno. Los errores listan solo
// nombres de variables, nunca sus valores.
export function loadEnv(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw invalid(result.error.issues.map((issue) => String(issue.path[0])));
  }

  const data = result.data;
  const isProduction = data.VERCEL_ENV === 'production';

  if (isProduction) {
    const bad = [];
    const origin = new URL(data.APP_ORIGIN);
    // APP_ORIGIN debe ser https y un origen "puro" (sin path, query ni hash).
    if (origin.protocol !== 'https:' || data.APP_ORIGIN !== origin.origin) bad.push('APP_ORIGIN');
    if (new URL(data.OAUTH_REDIRECT_URI).protocol !== 'https:') bad.push('OAUTH_REDIRECT_URI');
    if (bad.length > 0) throw invalid(bad);
  }

  return {
    databaseUrl: data.DATABASE_URL,
    googleClientId: data.GOOGLE_CLIENT_ID,
    googleClientSecret: data.GOOGLE_CLIENT_SECRET,
    oauthRedirectUri: data.OAUTH_REDIRECT_URI,
    adminEmail: data.ADMIN_EMAIL,
    appOrigin: data.APP_ORIGIN,
    ipHashSecret: data.IP_HASH_SECRET,
    vercelEnv: data.VERCEL_ENV,
    isProduction,
  };
}

function invalid(keys) {
  return new Error(`Invalid environment: ${[...new Set(keys)].join(', ')}`);
}
