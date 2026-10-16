import { useCallback, useEffect, useState } from 'react'
import { api } from './api.js'
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
    } catch {
      // Sin sesión la API responde un 404 genérico; cualquier otro fallo se trata igual.
      setState('anonymous')
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  if (state === 'loading') {
    return <main className="min-h-screen bg-ink" aria-busy="true" />
  }
  if (state === 'anonymous') {
    return import.meta.env.DEV ? <DevNotice /> : <LoginScreen onSession={loadSession} />
  }
  if (state.kind === 'recovery') {
    return <RecoveryScreen csrf={state.csrfToken} />
  }
  return <Dashboard csrf={state.csrfToken} onLoggedOut={loadSession} />
}
