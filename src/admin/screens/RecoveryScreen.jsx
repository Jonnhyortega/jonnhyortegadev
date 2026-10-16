import { useState } from 'react'
import { api, ApiError } from '../api.js'
import { GOOGLE_START, markLoginPending } from '../lib/loginPending.js'
import ConfirmDialog from '../components/ConfirmDialog.jsx'

export default function RecoveryScreen({ csrf }) {
  const [codes, setCodes] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expired, setExpired] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  // Desvincula la cuenta de Google y vuelve a entrar: el próximo login con Google
  // (que debe ser ADMIN_EMAIL, verificado) queda vinculado. Cierra esta sesión.
  const unlinkGoogle = async () => {
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/security/identity/reset', { method: 'POST', csrf })
      markLoginPending()
      window.location.assign(GOOGLE_START)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setExpired(true)
        setError('La sesión de recuperación venció. Volvé a entrar con Google.')
      } else {
        setError('No se pudo desvincular Google.')
      }
      setBusy(false)
    }
  }

  const generate = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await api('/api/admin/security/recovery-codes', { method: 'POST', csrf })
      setCodes(data.codes)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setExpired(true)
        setError('La sesión de recuperación venció. Volvé a entrar con Google.')
      } else {
        setError('No se pudieron generar los códigos.')
      }
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="min-h-screen bg-ink text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-purple-500/30 bg-ink-800 p-8 space-y-5">
        <h1 className="text-xl font-semibold">Recuperación</h1>

        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}

        {codes ? (
          <>
            <ul className="space-y-1 font-mono text-sm">
              {codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <p className="text-sm text-yellow-300">No vas a poder volver a verlos.</p>
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10"
            >
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <a
              href={GOOGLE_START}
              onClick={() => markLoginPending()}
              className="block w-full rounded-lg bg-purple-600 px-4 py-2 text-center font-medium hover:bg-purple-500"
            >
              Volver a entrar con Google
            </a>
          </>
        ) : expired ? (
          <a
            href={GOOGLE_START}
            onClick={() => markLoginPending()}
            className="block w-full rounded-lg bg-purple-600 px-4 py-2 text-center font-medium hover:bg-purple-500"
          >
            Volver a entrar con Google
          </a>
        ) : (
          <>
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium hover:bg-purple-500 disabled:opacity-50"
            >
              Generar códigos nuevos
            </button>
            <button
              type="button"
              onClick={() => setConfirmUnlink(true)}
              disabled={busy}
              className="w-full rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-50"
            >
              Desvincular Google y volver a entrar
            </button>
            <ConfirmDialog
              open={confirmUnlink}
              onOpenChange={setConfirmUnlink}
              title="¿Desvincular la cuenta de Google?"
              description="Se cierra esta sesión de recuperación y la próxima cuenta de Google con la que entres quedará vinculada al panel. Debe ser el email autorizado (ADMIN_EMAIL) y estar verificado."
              confirmLabel="Desvincular y entrar"
              onConfirm={unlinkGoogle}
            />
          </>
        )}
      </div>
    </main>
  )
}
