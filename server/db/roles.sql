-- Rol de mínimo privilegio para la aplicación (Vercel / DATABASE_URL).
-- La contraseña se define en la consola de Neon, nunca aquí.
-- Ejecutar con el rol propietario DESPUÉS de aplicar las migraciones.

CREATE ROLE portfolio_app WITH LOGIN;

-- Solo uso del schema; sin CREATE.
GRANT USAGE ON SCHEMA public TO portfolio_app;
REVOKE CREATE ON SCHEMA public FROM portfolio_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  admin_identity,
  sessions,
  oauth_flows,
  recovery_codes,
  rate_limits,
  translations,
  theme,
  projects,
  content_revisions,
  audit_log
TO portfolio_app;

-- Tablas que creen migraciones futuras: el mismo mínimo privilegio, sin re-ejecutar
-- este archivo. ALTER DEFAULT PRIVILEGES solo afecta a los objetos que cree el rol
-- que ejecuta la sentencia, así que debe correrse con el rol de migraciones (el que
-- usa DATABASE_URL_MIGRATIONS y crea las tablas).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portfolio_app;
