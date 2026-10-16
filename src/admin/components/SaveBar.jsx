// Barra de guardado con estado: cambios sin guardar, éxito y error.
export default function SaveBar({ dirty, saving, saved, error, onSave, children }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-purple-500/20 bg-ink-800 px-4 py-3">
      <button
        type="button"
        onClick={onSave}
        disabled={!dirty || saving}
        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-40"
      >
        {saving ? 'Guardando…' : 'Guardar'}
      </button>
      {children}
      <span role="status" className="text-sm">
        {error ? (
          <span className="text-red-300">{error.message}</span>
        ) : saved ? (
          <span className="text-green-300">Guardado.</span>
        ) : dirty ? (
          <span className="text-yellow-300">Cambios sin guardar.</span>
        ) : null}
      </span>
    </div>
  )
}
