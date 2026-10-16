// Cliente mínimo de la API del panel. Siempre same-origin y con CSRF en escrituras.
export class ApiError extends Error {
  constructor(status, code, fields) {
    super(code || `http_${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export async function api(path, { method = 'GET', body, csrf } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (method !== 'GET' && csrf) headers['X-CSRF-Token'] = csrf

  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) throw new ApiError(res.status, data?.error, data?.fields)
  return data
}
