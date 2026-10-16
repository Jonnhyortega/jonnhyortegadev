import { useCallback, useEffect, useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import ProjectForm from '../components/ProjectForm.jsx'
import { ApiError } from '../api.js'
import { describeError } from '../lib/errors.js'
import { emptyProject, moveItem, toInput } from '../lib/projects.js'

const btn = 'rounded-lg border border-purple-500/40 px-3 py-1 text-xs hover:bg-purple-500/10 disabled:opacity-30'

export default function ProjectsTab({ call }) {
  const [projects, setProjects] = useState(null)
  const [editing, setEditing] = useState(null) // null | { project|null } (null project = nuevo)
  const [toDelete, setToDelete] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setProjects(await call('/api/admin/projects'))
      setError(null)
    } catch (err) {
      setError(describeError(err))
    }
  }, [call])

  useEffect(() => {
    load()
  }, [load])

  // Ejecuta una operación y muestra el error si falla.
  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (err) {
      const described = describeError(err)
      // Conflicto o elemento borrado: se refresca la lista y luego se muestra el aviso.
      if (described.conflict || described.gone) await load()
      setError(described)
      return described.conflict || described.gone ? 'stale' : false
    } finally {
      setBusy(false)
    }
  }

  const move = (index, delta) =>
    run(async () => {
      const ids = moveItem(projects, index, delta).map((p) => p.id)
      setProjects(await call('/api/admin/projects/order', { method: 'PUT', body: { ids } }))
    })

  const update = (project, data) =>
    run(async () => {
      const saved = await call(`/api/admin/projects/${project.id}`, {
        method: 'PUT',
        body: { data, version: project.version },
      })
      setProjects((list) => list.map((p) => (p.id === saved.id ? saved : p)))
    })

  const submit = async (form) => {
    const data = toInput(form)
    const ok = await run(async () => {
      if (editing.project) {
        // Siempre con la versión actual de la lista, no la del momento de abrir el formulario.
        const current = projects.find((p) => p.id === editing.project.id)
        if (!current) throw new ApiError(404, 'not_found')
        const saved = await call(`/api/admin/projects/${current.id}`, {
          method: 'PUT',
          body: { data, version: current.version },
        })
        setProjects((list) => list.map((p) => (p.id === saved.id ? saved : p)))
      } else {
        const created = await call('/api/admin/projects', { method: 'POST', body: data })
        setProjects((list) => [...list, created])
      }
    })
    if (ok === true || ok === 'stale') setEditing(null)
  }

  const remove = async () => {
    const target = toDelete
    setToDelete(null)
    await run(async () => {
      await call(`/api/admin/projects/${target.id}`, { method: 'DELETE' })
      setProjects((list) => list.filter((p) => p.id !== target.id))
    })
  }

  if (!projects) {
    return error ? (
      <div className="space-y-3">
        <p role="alert" className="text-red-300">{error.message}</p>
        <button type="button" onClick={load} className={btn}>Reintentar</button>
      </div>
    ) : (
      <p aria-busy="true">Cargando…</p>
    )
  }

  return (
    <section aria-label="Proyectos" className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error.message}{' '}
          {error.conflict && <button type="button" onClick={load} className="underline">Recargar</button>}
        </p>
      )}

      {editing ? (
        <ProjectForm
          key={editing.project?.id ?? 'new'}
          initial={editing.project ? { ...editing.project, liveUrl: editing.project.liveUrl ?? '', githubUrl: editing.project.githubUrl ?? '' } : emptyProject()}
          fields={error?.fields}
          saving={busy}
          onSubmit={submit}
          onCancel={() => { setEditing(null); setError(null) }}
        />
      ) : (
        <button type="button" onClick={() => setEditing({ project: null })} disabled={projects.length >= 50} className={btn}>
          Nuevo proyecto
        </button>
      )}

      <ol className="space-y-2">
        {projects.map((p, i) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-purple-500/20 p-3">
            <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
            <span className="text-xs text-white/50">{p.tech.join(', ')}</span>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={p.published}
                disabled={busy}
                onChange={() => update(p, { ...toInput(p), published: !p.published })}
              />
              Publicado
            </label>
            <button type="button" aria-label={`Subir ${p.title}`} className={btn} disabled={busy || i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" aria-label={`Bajar ${p.title}`} className={btn} disabled={busy || i === projects.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className={btn} onClick={() => setEditing({ project: p })}>Editar</button>
            <button type="button" className={btn} onClick={() => setToDelete(p)}>Borrar</button>
          </li>
        ))}
      </ol>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Borrar proyecto"
        description={`Se va a borrar "${toDelete?.title ?? ''}". Esta acción no se puede deshacer.`}
        confirmLabel="Borrar"
        onConfirm={remove}
      />
    </section>
  )
}
