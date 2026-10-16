import { translationsSchema } from '../../schemas/translations.js';
import { putTranslations } from '../../services/content.js';
import { createSingletonRouter } from './singleton.js';

export const createTranslationsRouter = (deps) =>
  createSingletonRouter(deps, {
    entity: 'translations',
    schema: translationsSchema,
    write: putTranslations,
  });
