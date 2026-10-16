import { recordAudit, requestContext } from '../../services/audit.js';

// Registra una escritura de contenido en la bitácora de auditoría.
export function auditContent(deps, req, event, meta) {
  return recordAudit(deps.db, {
    event,
    ...requestContext(req, deps.env),
    meta,
    now: deps.now(),
  });
}
