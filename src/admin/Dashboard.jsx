import { useCallback, useEffect, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { api, ApiError } from './api.js'
import { hasRecentAlerts } from './lib/alerts.js'
import TranslationsTab from './tabs/TranslationsTab.jsx'
import ProjectsTab from './tabs/ProjectsTab.jsx'
import ThemeTab from './tabs/ThemeTab.jsx'
import SecurityTab from './tabs/SecurityTab.jsx'

const triggerClass =
  'px-4 py-2 text-sm text-white/70 border-b-2 border-transparent data-[state=active]:border-purple-400 data-[state=active]:text-white'

export default function Dashboard({ csrf, onLoggedOut }) {
  const [alert, setAlert] = useState(false)

  // Cliente con CSRF; si la sesión ya no existe (404 genérico) se vuelve al login.
  const call = useCallback(
    async (path, opts = {}) => {
      try {
        return await api(path, { ...opts, csrf })
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // Un 404 puede ser un elemento borrado o una sesión caída: se distingue con /me.
          try {
            await api('/api/admin/me')
          } catch (meErr) {
            if (meErr instanceof ApiError && meErr.status === 404) onLoggedOut()
          }
        }
        throw err
      }
    },
    [csrf, onLoggedOut],
  )

  useEffect(() => {
    call('/api/admin/security/audit')
      .then((events) => setAlert(hasRecentAlerts(events)))
      .catch(() => {})
  }, [call])

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', csrf })
    } catch {
      // Si falla, igual se vuelve a consultar la sesión para mostrar el estado real.
    }
    onLoggedOut()
  }

  return (
    <main className="min-h-screen bg-ink text-white">
      <header className="flex items-center justify-between border-b border-purple-500/20 px-4 py-3">
        <h1 className="text-lg font-semibold">Panel</h1>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-purple-500/40 px-4 py-2 text-sm hover:bg-purple-500/10"
        >
          Cerrar sesión
        </button>
      </header>

      {alert && (
        <p role="alert" className="mx-4 mt-4 rounded-lg border border-yellow-400/40 bg-yellow-400/10 p-3 text-sm text-yellow-200">
          Hubo intentos de acceso o recuperación en las últimas 24 h. Revisá la pestaña Seguridad.
        </p>
      )}

      <Tabs.Root defaultValue="texts" className="px-4 pb-8">
        <Tabs.List aria-label="Secciones del panel" className="flex flex-wrap border-b border-purple-500/20">
          <Tabs.Trigger value="texts" className={triggerClass}>Textos</Tabs.Trigger>
          <Tabs.Trigger value="projects" className={triggerClass}>Proyectos</Tabs.Trigger>
          <Tabs.Trigger value="theme" className={triggerClass}>Tema</Tabs.Trigger>
          <Tabs.Trigger value="security" className={triggerClass}>Seguridad</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="texts" className="pt-4">
          <TranslationsTab call={call} />
        </Tabs.Content>
        <Tabs.Content value="projects" className="pt-4">
          <ProjectsTab call={call} />
        </Tabs.Content>
        <Tabs.Content value="theme" className="pt-4">
          <ThemeTab call={call} />
        </Tabs.Content>
        <Tabs.Content value="security" className="pt-4">
          <SecurityTab call={call} onLoggedOut={onLoggedOut} />
        </Tabs.Content>
      </Tabs.Root>
    </main>
  )
}
