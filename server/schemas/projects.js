import { z } from 'zod';
import { TECH_KEYS } from '../../src/content/defaults.js';
import { sinControl } from './translations.js';

export const IMAGE_HOSTS = ['res.cloudinary.com', 'upload.wikimedia.org'];

// Cualquier espacio, backslash o carácter de control se rechaza ANTES de
// parsear: así el valor validado es el mismo que interpretará el navegador.
// eslint-disable-next-line no-control-regex -- los caracteres de control son justamente lo que se rechaza
const RAW_PROHIBIDO = /[\s\\\u0000-\u001F\u007F]/;

function parseHttps(value) {
  if (RAW_PROHIBIDO.test(value)) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  return url;
}

// Valida y persiste solo la forma canónica (href).
const safeUrl = (accept) =>
  z
    .string()
    .max(500)
    .refine(
      (value) => {
        const url = parseHttps(value);
        return url !== null && accept(url);
      },
      { message: 'URL no permitida' },
    )
    .transform((value) => new URL(value).href);

// `port` vacío = puerto por defecto de https.
const imageUrl = safeUrl((url) => url.port === '' && IMAGE_HOSTS.includes(url.hostname));
const linkUrl = safeUrl(() => true).nullable();

const text = (max) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine(sinControl, { message: 'caracteres de control no permitidos' });

export const projectInputSchema = z
  .object({
    title: text(80),
    descriptionEn: text(300),
    descriptionEs: text(300),
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
