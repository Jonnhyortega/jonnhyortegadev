import { api } from './api.js'

// Provisorio: la Task 16 lo reemplaza por el panel real.
export default function Dashboard({ csrf, onLoggedOut }) {
  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', csrf })
    } catch {
      // Si falla, igual se vuelve a consultar la sesión para mostrar el estado real.
    }
    onLoggedOut()
  }

  return (
    <main className="min-h-screen bg-ink text-white p-8">
      <h1 className="text-2xl font-semibold">Panel</h1>
      <button
        type="button"
        onClick={logout}
        className="mt-6 rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10"
      >
        Cerrar sesión
      </button>
    </main>
  )
}
