// Indicador de "login con Google en curso" (R37). El servidor ya no avisa de un
// rechazo: si el panel vuelve a cargar sin sesión y el indicador sigue puesto,
// el login falló. Solo se guarda "1", nunca la ruta del panel.
// `storage` es opcional (por defecto sessionStorage, que puede lanzar si está bloqueado).
const KEY = 'panel-login-pending'

export const GOOGLE_START = '/api/auth/google/start'

export function markLoginPending(storage) {
  try {
    ;(storage ?? window.sessionStorage).setItem(KEY, '1')
  } catch {
    // sin almacenamiento no hay aviso de error, pero el login sigue funcionando
  }
}

// Devuelve si había un login pendiente y borra el indicador.
export function takeLoginPending(storage) {
  try {
    const s = storage ?? window.sessionStorage
    const pending = s.getItem(KEY) === '1'
    s.removeItem(KEY)
    return pending
  } catch {
    return false
  }
}
