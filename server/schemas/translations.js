import { z } from 'zod';
import { DEFAULT_TRANSLATIONS } from '../../src/content/defaults.js';

// Rechaza caracteres de control (salvo tab, salto de línea y retorno).
const SIN_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const sinControl = (value) => !SIN_CONTROL.test(value);

const leaf = () =>
  z
    .string()
    .min(1)
    .max(500)
    .refine(sinControl, { message: 'caracteres de control no permitidos' });

// Construye un esquema estricto con la misma forma que el árbol de textos
// por defecto: solo se aceptan las claves existentes y hojas de texto.
export function buildStrictStringSchema(tree) {
  if (typeof tree === 'string') return leaf();
  const shape = {};
  for (const [key, value] of Object.entries(tree)) {
    shape[key] = buildStrictStringSchema(value);
  }
  return z.object(shape).strict();
}

export const translationsSchema = z
  .object({
    en: buildStrictStringSchema(DEFAULT_TRANSLATIONS.en),
    es: buildStrictStringSchema(DEFAULT_TRANSLATIONS.es),
  })
  .strict();
