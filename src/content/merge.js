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

const IMAGE_HOSTS = ['res.cloudinary.com', 'upload.wikimedia.org'];

// Solo https (igual que el servidor); cualquier otra cosa se descarta.
function safeUrl(value) {
  if (!isString(value) || value === '') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function safeImageUrl(value) {
  if (!isString(value)) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && IMAGE_HOSTS.includes(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
}

// Devuelve el proyecto saneado o null si no es válido.
function sanitizeProject(p) {
  if (
    !isPlainObject(p) ||
    !isString(p.id) ||
    !isString(p.title) ||
    !isString(p.descriptionEn) ||
    !isString(p.descriptionEs) ||
    !Array.isArray(p.tech) ||
    !p.tech.every(isString)
  ) {
    return null;
  }
  const imageUrl = safeImageUrl(p.imageUrl);
  if (!imageUrl) return null;
  return { ...p, imageUrl, liveUrl: safeUrl(p.liveUrl), githubUrl: safeUrl(p.githubUrl) };
}

function mergeProjects(defaults, remote) {
  // Sin traducciones remotas la BD no está sembrada: se ignoran también los proyectos.
  if (!isPlainObject(remote.translations) || !Array.isArray(remote.projects)) return defaults.projects;
  const list = remote.projects.map(sanitizeProject);
  // Un elemento de forma inválida invalida la lista; uno con imagen ajena solo se descarta.
  if (remote.projects.some((p) => !isPlainObject(p) || !isString(p.id))) return defaults.projects;
  return list.filter(Boolean);
}

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
    projects: mergeProjects(defaults, r),
    theme: sanitizeTheme(r.theme),
  };
}
