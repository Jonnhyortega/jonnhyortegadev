// Mezcla el contenido remoto (API) sobre los defaults locales. Nunca lanza:
// todo lo que no valida se descarta y queda el default.

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isString = (v) => typeof v === 'string';
const VAR_KEY = /^--c-[a-z0-9-]+$/;
const VAR_VALUE = /^\d{1,3} \d{1,3} \d{1,3}$/;

// Solo reemplazan strings no vacíos; claves que no existen en el default se ignoran.
function mergeStrings(base, remote) {
  if (typeof base === 'string') {
    return isString(remote) && remote.trim() !== '' ? remote : base;
  }
  if (!isPlainObject(base)) return base;
  const out = {};
  for (const key of Object.keys(base)) {
    out[key] = mergeStrings(base[key], isPlainObject(remote) ? remote[key] : undefined);
  }
  return out;
}

const isValidProject = (p) =>
  isPlainObject(p) &&
  isString(p.id) &&
  isString(p.title) &&
  isString(p.imageUrl) &&
  Array.isArray(p.tech) &&
  p.tech.every(isString);

function sanitizeTheme(theme) {
  if (!isPlainObject(theme) || !isPlainObject(theme.vars)) return null;
  const vars = {};
  for (const [key, value] of Object.entries(theme.vars)) {
    if (VAR_KEY.test(key) && isString(value) && VAR_VALUE.test(value)) vars[key] = value;
  }
  return { colors: isPlainObject(theme.colors) ? theme.colors : {}, vars };
}

export function mergeContent(defaults, remote) {
  const r = isPlainObject(remote) ? remote : {};
  const rt = isPlainObject(r.translations) ? r.translations : {};
  return {
    translations: {
      en: mergeStrings(defaults.translations.en, rt.en),
      es: mergeStrings(defaults.translations.es, rt.es),
    },
    projects:
      Array.isArray(r.projects) && r.projects.every(isValidProject) ? r.projects : defaults.projects,
    theme: sanitizeTheme(r.theme),
  };
}
