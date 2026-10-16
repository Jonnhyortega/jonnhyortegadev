import { useState } from 'react'
import { api, ApiError } from '../api.js'
import { GOOGLE_START, markLoginPending } from '../lib/loginPending.js'

export default function RecoveryScreen({ csrf }) {
  const [codes, setCodes] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [expired, setExpired] = useState(false)

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
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium hover:bg-purple-500 disabled:opacity-50"
          >
            Generar códigos nuevos
          </button>
        )}
      </div>
    </main>
  )
}
