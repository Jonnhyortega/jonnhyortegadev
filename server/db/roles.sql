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
