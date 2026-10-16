// Error con estado HTTP y un código estable que se devuelve al cliente.
export class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export class NotFoundError extends HttpError {
  constructor() {
    super(404, 'not_found');
  }
}

export class VersionConflictError extends HttpError {
  constructor() {
    super(409, 'version_conflict');
  }
}
