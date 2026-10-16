// Marca la respuesta como no cacheable (rutas de sesión y de administración).
export function noStore(req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}
