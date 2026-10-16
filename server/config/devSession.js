// Guardas de DEV_FAKE_SESSION. La sesión falsa nunca debe crearse en la BD
// de producción: exige una BD de desarrollo distinta y un entorno local.
// Devuelve la URL de la BD de desarrollo; lanza un Error (sin valores) si no
// se permite.
export function assertDevFakeSessionAllowed(processEnv) {
  if (processEnv.VERCEL_ENV) {
    throw new Error('DEV_FAKE_SESSION no se permite con VERCEL_ENV definido.');
  }
  if (processEnv.NODE_ENV === 'production') {
    throw new Error('DEV_FAKE_SESSION no se permite con NODE_ENV=production.');
  }
  const devUrl = processEnv.DEV_DATABASE_URL;
  if (!devUrl) {
    throw new Error('DEV_FAKE_SESSION requiere DEV_DATABASE_URL (una BD solo de desarrollo).');
  }
  if (devUrl === processEnv.DATABASE_URL) {
    throw new Error('DEV_DATABASE_URL debe ser distinta de DATABASE_URL.');
  }
  return devUrl;
}
