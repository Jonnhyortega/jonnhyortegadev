import { requestContext } from '../../services/audit.js';

// Argumento `audit` para los servicios de escritura: se inserta dentro de la
// misma transacción que el cambio de contenido.
export function auditFor(deps, req, event, meta) {
  return { event, ...requestContext(req, deps.env), meta };
}
