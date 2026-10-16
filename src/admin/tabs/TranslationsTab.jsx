import { useEffect, useMemo, useState } from 'react'
import Field from '../components/Field.jsx'
import SaveBar from '../components/SaveBar.jsx'
import { useEntity } from '../lib/useEntity.js'
import { flattenTranslations, getPath, setPath } from '../lib/translations.js'
import { DEFAULT_TRANSLATIONS } from '../../content/defaults.js'

const MAX_LEN = 500

export default function TranslationsTab({ call }) {
  const { loading, data, saving, error, saved, load, save } = useEntity(call, '/api/admin/translations')
  const [draft, setDraft] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

  const rows = useMemo(() => (draft ? flattenTranslations(draft) : []), [draft])
  const dirty = draft !== null && data !== null && JSON.stringify(draft) !== JSON.stringify(data)

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? rows.filter((r) => `${r.key} ${r.en} ${r.es}`.toLowerCase().includes(needle))
    : rows

  // Errores por campo: "data.en.hero.title" → "en.hero.title".
  const fieldErrors = new Set((error?.fields ?? []).map((f) => f.replace(/^data\./, '')))
  const errorFor = (lang, key) =>
    fieldErrors.has(`${lang}.${key}`) ? 'Texto no válido (1 a 500 caracteres).' : undefined

  const edit = (lang, key, value) => setDraft((d) => setPath(d, `${lang}.${key}`, value))
  const restoreDefault = (key) => {
    for (const lang of ['en', 'es']) {
      edit(lang, key, getPath(DEFAULT_TRANSLATIONS[lang], key) ?? '')
    }
  }

  if (loading) return <p aria-busy="true">Cargando…</p>
  if (!draft) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-red-300">{error?.message}</p>
        <button type="button" onClick={load} className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <section aria-label="Textos">
      <Field label="Buscar por clave o texto" value={query} onChange={setQuery} type="search" />
      <p className="mb-4 text-xs text-white/50">
        {visible.length} de {rows.length} claves. Cada texto admite hasta {MAX_LEN} caracteres.
      </p>

      <ul className="space-y-5">
        {visible.map((row) => (
          <li key={row.key} className="rounded-xl border border-purple-500/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <code className="text-sm text-purple-300">{row.key}</code>
              <button
                type="button"
                onClick={() => restoreDefault(row.key)}
                className="text-xs text-white/60 underline hover:text-white"
              >
                Restaurar default
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {['en', 'es'].map((lang) => (
                <Field
                  key={lang}
                  label={`${row.key} (${lang.toUpperCase()})`}
                  value={row[lang]}
                  onChange={(v) => edit(lang, row.key, v)}
                  error={errorFor(lang, row.key)}
                  maxLength={MAX_LEN}
                  multiline
                />
              ))}
            </div>
          </li>
        ))}
      </ul>

      <SaveBar dirty={dirty} saving={saving} saved={saved} error={error} onSave={() => save(draft)}>
        {error?.conflict && (
          <button type="button" onClick={load} className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm">
            Recargar
          </button>
        )}
      </SaveBar>
    </section>
  )
}
