import { HttpError } from '../lib/errors.js';

// Error de validación: solo rutas de campos, nunca valores ni mensajes de Zod.
export class InvalidInputError extends HttpError {
  constructor(fields) {
    super(400, 'invalid_input');
    this.fields = fields;
  }
}

// Valida `req.body` con el esquema y lo reemplaza por la salida parseada
// (así aplican las transformaciones, p. ej. URLs canónicas).
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = [...new Set(result.error.issues.flatMap(issuePaths))];
      return next(new InvalidInputError(fields));
    }
    req.body = result.data;
    next();
  };
}

// Una clave desconocida (strict) se reporta como `ruta.clave`.
function issuePaths(issue) {
  const base = issue.path.map(String);
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => [...base, key].join('.'));
  }
  return [base.join('.')];
}
