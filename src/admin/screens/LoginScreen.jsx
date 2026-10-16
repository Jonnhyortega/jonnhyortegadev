import { useState } from 'react'
import { api, ApiError } from '../api.js'
import { GOOGLE_START, markLoginPending } from '../lib/loginPending.js'

const MESSAGES = {
  invalid_code: 'Código inválido.',
  rate_limited: 'Demasiados intentos. Probá más tarde.',
}

export default function LoginScreen({ onSession, loginFailed = false }) {
  const [showCode, setShowCode] = useState(false)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState(loginFailed ? 'No se pudo iniciar sesión.' : '')
  const [busy, setBusy] = useState(false)

  const submitCode = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      await api('/api/auth/recovery', { method: 'POST', body: { code: code.trim() } })
      await onSession()
    } catch (err) {
      setMessage((err instanceof ApiError && MESSAGES[err.code]) || 'No se pudo iniciar sesión.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-ink text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-purple-500/30 bg-ink-800 p-8 space-y-5">
        <h1 className="text-xl font-semibold">Acceso</h1>

        {message && (
          <p role="alert" className="text-sm text-red-300">
            {message}
          </p>
        )}

        <a
          href={GOOGLE_START}
          onClick={() => markLoginPending()}
          className="block w-full rounded-lg bg-purple-600 px-4 py-2 text-center font-medium hover:bg-purple-500"
        >
          Entrar con Google
        </a>

        {!showCode ? (
          <button
            type="button"
            onClick={() => setShowCode(true)}
            className="text-sm text-purple-300 underline"
          >
            Usar código de recuperación
          </button>
        ) : (
          <form onSubmit={submitCode} className="space-y-3">
            <label className="block text-sm text-white/80" htmlFor="recovery-code">
              Código de recuperación
            </label>
            <input
              id="recovery-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              spellCheck="false"
              className="w-full rounded-lg border border-purple-500/30 bg-ink px-3 py-2 font-mono"
              placeholder="XXXX-XXXX-XXXX"
            />
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="w-full rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10 disabled:opacity-50"
            >
              Entrar
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
