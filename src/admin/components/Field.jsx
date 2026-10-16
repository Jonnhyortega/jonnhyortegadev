import { useId } from 'react'

const base =
  'w-full rounded-lg border bg-ink px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-400'

// Campo con etiqueta, contador opcional y mensaje de error asociado.
export default function Field({
  label,
  value,
  onChange,
  error,
  multiline = false,
  maxLength,
  type = 'text',
  hideLabel = false,
  ...rest
}) {
  const id = useId()
  const errId = `${id}-err`
  const props = {
    id,
    value,
    onChange: (e) => onChange(e.target.value),
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? errId : undefined,
    className: `${base} ${error ? 'border-red-400' : 'border-purple-500/30'}`,
    ...rest,
  }
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'block text-xs text-white/70'}>
        {label}
      </label>
      {multiline ? <textarea rows={2} {...props} /> : <input type={type} {...props} />}
      <div className="flex justify-between text-xs">
        <span id={errId} className="text-red-300">
          {error || ''}
        </span>
        {maxLength ? (
          <span className="text-white/40">
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
    </div>
  )
}
