import { themeSchema } from '../../schemas/theme.js';
import { putTheme } from '../../services/content.js';
import { createSingletonRouter } from './singleton.js';

export const createThemeRouter = (deps) =>
  createSingletonRouter(deps, { entity: 'theme', schema: themeSchema, write: putTheme });
