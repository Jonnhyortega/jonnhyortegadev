import { ApiError } from '../api.js'

// Convierte un error de la API en un mensaje para mostrar y, si hay, errores por campo.
export function describeError(err) {
  if (!(err instanceof ApiError)) {
    return { message: 'No se pudo conectar con el servidor.', fields: [] }
  }
  if (err.status === 409 && err.code === 'version_conflict') {
    return { message: 'Otra pestaña guardó cambios; recargá.', conflict: true, fields: [] }
  }
  if (err.status === 409 && err.code === 'revision_incompatible') {
    return { message: 'Esa versión ya no es compatible con el contenido actual.', fields: [] }
  }
  if (err.status === 400 && err.code === 'invalid_input') {
    return { message: 'Hay campos con errores; revisalos.', fields: err.fields ?? [] }
  }
  if (err.status === 400 && err.code === 'limit_reached') {
    return { message: 'Llegaste al máximo de 50 proyectos.', fields: [] }
  }
  if (err.status === 400 && err.code === 'invalid_order') {
    return { message: 'El orden no es válido; recargá la lista.', fields: [] }
  }
  if (err.status === 429) return { message: 'Demasiados intentos; esperá un momento.', fields: [] }
  return { message: 'No se pudo completar la operación.', fields: [] }
}
