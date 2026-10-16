import { useEffect, useState } from 'react'
import SaveBar from '../components/SaveBar.jsx'
import { useEntity } from '../lib/useEntity.js'
import { contrastRatio } from '../lib/contrast.js'
import { DEFAULT_THEME } from '../../content/defaults.js'
import { themeToCssVars } from '../../content/theme.js'

const LABELS = {
  primary: 'Principal',
  secondary: 'Secundario',
  accent: 'Acento',
  highlight: 'Resaltado',
  ink: 'Fondo (ink)',
}
const MIN_CONTRAST = 4.5

export default function ThemeTab({ call }) {
  const { loading, data, saving, error, saved, load, save } = useEntity(call, '/api/admin/theme')
  const [draft, setDraft] = useState(null)

  useEffect(() => {
    if (data) setDraft(data)
  }, [data])

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

  const dirty = JSON.stringify(draft) !== JSON.stringify(data)
  const lowContrast = ['highlight', 'primary'].filter(
    (key) => contrastRatio(draft[key], draft.ink) < MIN_CONTRAST,
  )
  const invalid = new Set((error?.fields ?? []).map((f) => f.replace(/^data\./, '')))

  return (
    <section aria-label="Tema" className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(LABELS).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-purple-500/20 p-3 text-sm">
            <span>
              {label}
              <span className="block font-mono text-xs text-white/50">{draft[key]}</span>
              {invalid.has(key) && <span className="text-xs text-red-300">Color no válido.</span>}
            </span>
            <input
              type="color"
              value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              className="h-10 w-14 cursor-pointer rounded bg-transparent"
            />
          </label>
        ))}
      </div>

      {lowContrast.length > 0 && (
        <p role="alert" className="rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-sm text-yellow-200">
          Contraste bajo (menos de {MIN_CONTRAST}:1) contra el fondo en:{' '}
          {lowContrast.map((k) => LABELS[k]).join(', ')}. Puede costar leer los textos.
        </p>
      )}

      <div>
        <h2 className="mb-2 text-sm text-white/70">Vista previa</h2>
        {/* Las variables solo se aplican dentro de este contenedor de muestra. */}
        <div style={themeToCssVars(draft)} className="space-y-4 rounded-2xl bg-ink p-6 text-white">
          <h3 className="text-xl font-semibold text-yellow-400">Título resaltado</h3>
          <div className="space-y-3 rounded-xl border border-purple-500/30 bg-violet-900/40 p-4">
            <p className="text-sm text-white/80">Texto de una tarjeta de ejemplo.</p>
            <span className="inline-block rounded-full bg-fuchsia-500/20 px-3 py-1 text-xs text-fuchsia-300">etiqueta</span>
          </div>
          <button type="button" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500">
            Botón de ejemplo
          </button>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={saved} error={error} onSave={() => save(draft)}>
        <button
          type="button"
          onClick={() => setDraft({ ...DEFAULT_THEME })}
          className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10"
        >
          Volver a los colores originales
        </button>
        {error?.conflict && (
          <button type="button" onClick={load} className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm">
            Recargar
          </button>
        )}
      </SaveBar>
    </section>
  )
}
