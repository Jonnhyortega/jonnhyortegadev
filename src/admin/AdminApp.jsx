import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from './api.js'
import LoginScreen from './screens/LoginScreen.jsx'
import RecoveryScreen from './screens/RecoveryScreen.jsx'
import DevNotice from './screens/DevNotice.jsx'
import Dashboard from './Dashboard.jsx'

export default function AdminApp() {
  // state: 'loading' | 'anonymous' | { kind, csrfToken, expiresAt }
  const [state, setState] = useState('loading')

  const loadSession = useCallback(async () => {
    try {
      setState(await api('/api/admin/me'))
    } catch (err) {
      // Sin sesión la API responde un 404 genérico; cualquier otro fallo es un error de conexión.
      setState(err instanceof ApiError && err.status === 404 ? 'anonymous' : 'error')
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  if (state === 'loading') {
    return <main className="min-h-screen bg-ink" aria-busy="true" />
  }
  if (state === 'error') {
    return (
      <main className="min-h-screen bg-ink text-white flex flex-col items-center justify-center gap-4 p-6">
        <p role="alert" className="text-white/80">
          No se pudo conectar con el servidor.
        </p>
        <button
          type="button"
          onClick={() => {
            setState('loading')
            loadSession()
          }}
          className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10"
        >
          Reintentar
        </button>
      </main>
    )
  }
  if (state === 'anonymous') {
    return import.meta.env.DEV ? <DevNotice /> : <LoginScreen onSession={loadSession} />
  }
  if (state.kind === 'recovery') {
    return <RecoveryScreen csrf={state.csrfToken} />
  }
  return <Dashboard csrf={state.csrfToken} onLoggedOut={loadSession} />
}
