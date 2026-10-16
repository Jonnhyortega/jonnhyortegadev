import { z } from 'zod';
import { TECH_KEYS } from '../../src/content/defaults.js';

export const IMAGE_HOSTS = ['res.cloudinary.com', 'upload.wikimedia.org'];

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

// https, sin credenciales; devuelve la URL parseada o null.
function httpsUrl(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  return url;
}

const imageUrl = z
  .string()
  .max(500)
  .refine(
    (value) => {
      const url = httpsUrl(value);
      // `port` vacío = puerto por defecto de https.
      return !!url && url.port === '' && IMAGE_HOSTS.includes(url.hostname);
    },
    { message: 'imageUrl debe ser https de un host permitido' },
  );

const linkUrl = z
  .string()
  .max(500)
  .refine((value) => httpsUrl(value) !== null, { message: 'solo https' })
  .nullable();

export const projectInputSchema = z
  .object({
    title: z.string().min(1).max(80),
    descriptionEn: z.string().min(1).max(300),
    descriptionEs: z.string().min(1).max(300),
    imageUrl,
    liveUrl: linkUrl,
    githubUrl: linkUrl,
    tech: z
      .array(z.enum(TECH_KEYS))
      .min(1)
      .max(8)
      .refine((list) => new Set(list).size === list.length, { message: 'tech duplicado' }),
    published: z.boolean(),
  })
  .strict();

export const withVersion = (schema) =>
  z.object({ data: schema, version: z.number().int().nonnegative() }).strict();
