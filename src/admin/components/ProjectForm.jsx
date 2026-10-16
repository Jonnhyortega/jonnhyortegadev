import { useState } from 'react'
import Field from './Field.jsx'
import { TECH_KEYS } from '../../content/defaults.js'
import { isAllowedImageUrl } from '../lib/projects.js'

// Formulario de alta/edición. `fields` son las rutas con error devueltas por el servidor.
export default function ProjectForm({ initial, fields = [], saving, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const serverError = (key) =>
    fields.some((f) => f.replace(/^data\./, '').split('.')[0] === key) ? 'Valor no válido.' : undefined
  const imageError =
    form.imageUrl !== '' && !isAllowedImageUrl(form.imageUrl)
      ? 'Debe ser https en res.cloudinary.com o upload.wikimedia.org.'
      : serverError('imageUrl')

  const toggleTech = (key) =>
    setForm((f) => ({
      ...f,
      tech: f.tech.includes(key) ? f.tech.filter((t) => t !== key) : [...f.tech, key],
    }))

  const submit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-purple-500/30 p-4">
      <Field label="Título" value={form.title} onChange={set('title')} maxLength={80} error={serverError('title')} />
      <Field label="Descripción (EN)" value={form.descriptionEn} onChange={set('descriptionEn')} maxLength={300} multiline error={serverError('descriptionEn')} />
      <Field label="Descripción (ES)" value={form.descriptionEs} onChange={set('descriptionEs')} maxLength={300} multiline error={serverError('descriptionEs')} />
      <Field label="URL de la imagen" value={form.imageUrl} onChange={set('imageUrl')} error={imageError} />
      <Field label="URL del sitio (opcional)" value={form.liveUrl ?? ''} onChange={set('liveUrl')} error={serverError('liveUrl')} />
      <Field label="URL de GitHub (opcional)" value={form.githubUrl ?? ''} onChange={set('githubUrl')} error={serverError('githubUrl')} />

      <fieldset>
        <legend className="mb-1 text-xs text-white/70">Tecnologías (1 a 8)</legend>
        <div className="flex flex-wrap gap-2">
          {TECH_KEYS.map((key) => (
            <label
              key={key}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                form.tech.includes(key) ? 'border-purple-400 bg-purple-500/20' : 'border-purple-500/30'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={form.tech.includes(key)}
                onChange={() => toggleTech(key)}
              />
              {key}
            </label>
          ))}
        </div>
        {serverError('tech') && <p className="mt-1 text-xs text-red-300">Elegí entre 1 y 8 tecnologías.</p>}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.published} onChange={(e) => set('published')(e.target.checked)} />
        Publicado
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || Boolean(imageError)}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500 disabled:opacity-40"
        >
          {saving ? 'Guardando…' : 'Guardar proyecto'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
