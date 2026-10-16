import { useCallback, useEffect, useState } from 'react'
import { describeError } from './errors.js'

// Carga y guarda una entidad de fila única (/translations, /theme) con control de versión.
// `call(path, opts)` es el cliente de API del Dashboard (ya lleva el CSRF).
export function useEntity(call, path) {
  const [state, setState] = useState({ loading: true, data: null, version: 0 })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null) // { message, fields, conflict }
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setState({ loading: true, data: null, version: 0 })
    setError(null)
    setSaved(false)
    try {
      const res = await call(path)
      setState({ loading: false, data: res.data, version: res.version })
    } catch (err) {
      setState({ loading: false, data: null, version: 0 })
      setError(describeError(err))
    }
  }, [call, path])

  useEffect(() => {
    load()
  }, [load])

  const save = async (data) => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await call(path, { method: 'PUT', body: { data, version: state.version } })
      setState({ loading: false, data: res.data, version: res.version })
      setSaved(true)
      return res.data
    } catch (err) {
      setError(describeError(err))
      return null
    } finally {
      setSaving(false)
    }
  }

  return { ...state, saving, error, saved, load, save }
}
