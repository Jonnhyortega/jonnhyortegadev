import { useCallback, useEffect, useState } from 'react'
import CodesDialog from '../components/CodesDialog.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { describeError } from '../lib/errors.js'

const ENTITIES = [
  ['translations', 'Textos'],
  ['theme', 'Tema'],
  ['projects', 'Proyectos'],
]
const btn = 'rounded-lg border border-purple-500/40 px-3 py-1 text-xs hover:bg-purple-500/10 disabled:opacity-30'
const fmt = (iso) => new Date(iso).toLocaleString('es-AR')

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default function SecurityTab({ call, onLoggedOut }) {
  const [sessions, setSessions] = useState([])
  const [audit, setAudit] = useState([])
  const [revisions, setRevisions] = useState({})
  const [notice, setNotice] = useState(null) // { text, ok }
  const [codes, setCodes] = useState(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [confirmCodes, setConfirmCodes] = useState(false)
  const [toRestore, setToRestore] = useState(null) // { id, label, createdAt }
  const [busy, setBusy] = useState(false)

  const loadAll = useCallback(async () => {
    const results = await Promise.allSettled([
      call('/api/admin/security/sessions'),
      call('/api/admin/security/audit'),
      ...ENTITIES.map(([key]) => call(`/api/admin/revisions/${key}`)),
    ])
    const [s, a, ...r] = results
    // Cada sección se actualiza si su pedido salió bien; un fallo no vacía a las demás.
    if (s.status === 'fulfilled') setSessions(s.value)
    if (a.status === 'fulfilled') setAudit(a.value)
    setRevisions((prev) => {
      const next = { ...prev }
      ENTITIES.forEach(([key], i) => {
        if (r[i].status === 'fulfilled') next[key] = r[i].value
      })
      return next
    })
    const failed = results.find((x) => x.status === 'rejected')
    if (failed) setNotice({ text: describeError(failed.reason).message, ok: false })
  }, [call])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const run = async (fn, okText) => {
    setBusy(true)
    setNotice(null)
    try {
      await fn()
      if (okText) setNotice({ text: okText, ok: true })
    } catch (err) {
      setNotice({ text: describeError(err).message, ok: false })
    } finally {
      setBusy(false)
    }
  }

  const restore = (rev) => {
    setToRestore(null)
    return run(async () => {
      await call(`/api/admin/revisions/${rev.id}/restore`, { method: 'POST' })
      await loadAll()
    }, 'Versión restaurada. Las otras pestañas se recargan al abrirlas.')
  }

  const generateCodes = () => {
    setConfirmCodes(false)
    return run(async () => {
      // Los códigos solo viven en este estado mientras el diálogo está abierto.
      const res = await call('/api/admin/security/recovery-codes', { method: 'POST' })
      setCodes(res.codes)
    })
  }

  const revokeAll = async () => {
    setConfirmAll(false)
    await run(async () => {
      await call('/api/admin/security/sessions', { method: 'DELETE' })
      onLoggedOut()
    })
  }

  return (
    <div className="space-y-8">
      {notice && (
        <p role={notice.ok ? 'status' : 'alert'} className={`text-sm ${notice.ok ? 'text-green-300' : 'text-red-300'}`}>
          {notice.text}
        </p>
      )}

      <Section title="Sesiones activas">
        <ul className="space-y-2 text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-xl border border-purple-500/20 p-3">
              <span className="font-medium">{s.kind}</span>
              {s.current && <span className="ml-2 text-xs text-green-300">esta sesión</span>}
              <span className="block text-xs text-white/60">
                Inicio {fmt(s.createdAt)} · última actividad {fmt(s.lastSeenAt)}
              </span>
              <span className="block truncate text-xs text-white/40">{s.userAgent}</span>
            </li>
          ))}
        </ul>
        <button type="button" className={btn} disabled={busy} onClick={() => setConfirmAll(true)}>
          Cerrar todas
        </button>
      </Section>

      <Section title="Códigos de recuperación">
        <p className="text-sm text-white/70">
          Generar códigos nuevos invalida los anteriores. Se muestran una sola vez.
        </p>
        <button type="button" className={btn} disabled={busy} onClick={() => setConfirmCodes(true)}>
          Generar códigos de recuperación
        </button>
      </Section>

      <Section title="Historial de cambios">
        {ENTITIES.map(([key, label]) => (
          <div key={key}>
            <h3 className="mb-1 text-sm text-purple-300">{label}</h3>
            <ul className="space-y-1 text-sm">
              {(revisions[key] ?? []).length === 0 && <li className="text-white/40">Sin versiones anteriores.</li>}
              {(revisions[key] ?? []).map((rev) => (
                <li key={rev.id} className="flex items-center justify-between gap-3">
                  <span>{fmt(rev.createdAt)}</span>
                  <button type="button" className={btn} disabled={busy} onClick={() => setToRestore({ ...rev, label })}>
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Últimos eventos">
        <ul className="space-y-1 text-sm">
          {audit.map((e, i) => (
            <li key={`${e.createdAt}-${i}`} className="flex justify-between gap-3">
              <code>{e.event}</code>
              <span className="text-white/50">{fmt(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <ConfirmDialog
        open={confirmCodes}
        onOpenChange={setConfirmCodes}
        title="Generar códigos nuevos"
        description="Los códigos de recuperación que tengas hoy dejan de funcionar. Los nuevos se muestran una sola vez."
        confirmLabel="Generar"
        onConfirm={generateCodes}
      />
      <ConfirmDialog
        open={toRestore !== null}
        onOpenChange={(open) => !open && setToRestore(null)}
        title="Restaurar versión"
        description={toRestore ? `El contenido actual de "${toRestore.label}" se reemplaza por la versión del ${fmt(toRestore.createdAt)}.` : ''}
        confirmLabel="Restaurar"
        onConfirm={() => restore(toRestore)}
      />
      {codes && <CodesDialog codes={codes} onClose={() => setCodes(null)} />}
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Cerrar todas las sesiones"
        description="Se cerrará también esta sesión y vas a tener que volver a entrar."
        confirmLabel="Cerrar todas"
        onConfirm={revokeAll}
      />
    </div>
  )
}
