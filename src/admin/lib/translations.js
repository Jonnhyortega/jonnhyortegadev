// Utilidades puras para editar el árbol de textos como una lista plana de claves.

function collectKeys(tree, prefix, out) {
  for (const [k, v] of Object.entries(tree ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') collectKeys(v, path, out)
    else out.add(path)
  }
}

function getPath(tree, path) {
  let cur = tree
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

// { en, es } → [{ key: 'hero.title', en, es }] (orden de aparición, en primero).
export function flattenTranslations(data) {
  const keys = new Set()
  collectKeys(data.en, '', keys)
  collectKeys(data.es, '', keys)
  return [...keys].map((key) => ({
    key,
    en: getPath(data.en, key) ?? '',
    es: getPath(data.es, key) ?? '',
  }))
}

// Inversa de flattenTranslations.
export function unflattenTranslations(rows) {
  const out = { en: {}, es: {} }
  for (const row of rows) {
    for (const lang of ['en', 'es']) {
      const parts = row.key.split('.')
      let cur = out[lang]
      parts.slice(0, -1).forEach((part) => {
        cur[part] ??= {}
        cur = cur[part]
      })
      cur[parts[parts.length - 1]] = row[lang]
    }
  }
  return out
}

// Copia del árbol con `path` (p. ej. 'en.hero.title') cambiado; no muta el original.
export function setPath(tree, path, value) {
  const [head, ...rest] = path.split('.')
  return {
    ...tree,
    [head]: rest.length === 0 ? value : setPath(tree?.[head] ?? {}, rest.join('.'), value),
  }
}

export { getPath }
