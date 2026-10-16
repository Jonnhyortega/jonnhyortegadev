const DAY_MS = 24 * 60 * 60 * 1000

// Hay eventos de seguridad (recovery_* o login_rejected) en las últimas 24 h.
export function hasRecentAlerts(events, now = Date.now()) {
  return events.some(
    (e) =>
      (e.event.startsWith('recovery_') || e.event === 'login_rejected') &&
      now - new Date(e.createdAt).getTime() < DAY_MS,
  )
}
