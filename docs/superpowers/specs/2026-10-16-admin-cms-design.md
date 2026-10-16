# Admin CMS del portfolio — Diseño

- **Fecha:** 2026-10-16
- **Rama:** `feat/admin-cms` (desde `redesign-3d`)
- **Estado:** aprobado en conversación, pendiente de revisión escrita

## 1. Objetivo

Permitir que el dueño del portfolio edite, sin tocar código ni redeployar:

1. **Textos** del sitio en inglés y español (hero, nav, secciones, contacto, footer, chatbot).
2. **Proyectos**: crear, editar, borrar, reordenar, publicar/ocultar.
3. **Paleta de colores** del tema, con vista previa.

El sitio está enlazado desde LinkedIn y el repositorio es **público**, por lo que se asume
un atacante activo que lee el código fuente. La seguridad es el requisito principal.

### Criterios de éxito

- Solo `jonnhyortega@gmail.com` (verificado por Google) puede escribir contenido.
- El sitio público sigue funcionando aunque la API o la base de datos estén caídas.
- Ninguna ruta pública acepta entrada del usuario que llegue a la base de datos.
- Todos los casos de seguridad de la sección 9 tienen tests automatizados en verde.
- La ruta del panel no aparece en ningún archivo del repositorio ni del bundle público.

### Fuera de alcance (YAGNI)

- Edición de la sección Skills.
- Subida de imágenes (se usan URLs de Cloudinary).
- Notificaciones por email.
- Múltiples usuarios o roles.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Hosting | Proyecto Vercel `jonnhyortegadev` (mismo dominio para front y API) |
| Backend | Express exportado como función serverless de Vercel |
| Base de datos | Neon Postgres + Drizzle ORM |
| Login | Google OAuth 2.0 (Authorization Code + PKCE), allowlist de un email |
| Recuperación | 10 códigos de un solo uso, argon2id, mostrados una única vez |
| Entrega de contenido | Lectura en runtime (`GET /api/content`) cacheada en CDN + fallback empaquetado |
| Ruta del panel | Secreta, definida solo en la env `ADMIN_PATH` de Vercel |

## 3. Arquitectura

```
portfoliodev/
├── api/index.js              # entrada Vercel: export default app
├── middleware.js             # Vercel Routing Middleware: ADMIN_PATH → panel
├── admin.html                # entrada HTML separada (Vite multi-page) del panel
├── server/
│   ├── app.js                # composición de Express y orden de middlewares
│   ├── config/env.js         # validación Zod de variables de entorno (fail-fast)
│   ├── db/{client,schema}.js # Neon serverless + esquema Drizzle
│   ├── db/migrations/        # migraciones generadas por drizzle-kit
│   ├── middleware/           # headers, session, csrf, rateLimit, requireAdmin, errors
│   ├── routes/               # auth, recovery, content, admin/{translations,projects,theme,security}
│   ├── services/             # sessions, oauth, recoveryCodes, content, audit, rateLimit
│   └── schemas/              # esquemas Zod de entrada
├── src/
│   ├── content/defaults.js   # contenido actual extraído del código (fallback + seed)
│   ├── context/ContentContext.jsx
│   └── admin/                # SPA del panel (solo se compila en el entry admin.html)
└── tests/server/             # Vitest + Supertest + PGlite
```

### Flujo público

1. `main.jsx` monta `ContentProvider`, que pide `GET /api/content`.
2. La respuesta (`Cache-Control: public, s-maxage=60, stale-while-revalidate=600`) trae
   `translations`, `projects` publicados y `theme`.
3. Se combina con `defaults.js` (los valores de la API ganan; claves faltantes usan default).
4. El tema se aplica escribiendo variables CSS en `document.documentElement`.
5. Si la petición falla, se usa `defaults.js` sin error visible.

`LanguageContext` mantiene la misma API `t('ruta.clave')` pero lee del contenido combinado.
`Projects.jsx` deja de tener el array hardcodeado y lo toma del contexto.

### Flujo admin

1. El navegador pide `ADMIN_PATH`. `middleware.js` compara con `process.env.ADMIN_PATH` y, si
   coincide **y** `VERCEL_ENV === 'production'`, reescribe internamente a `/admin.html`.
2. Cualquier petición directa a `/admin.html` devuelve 404 desde el middleware.
3. El panel habla solo con `/api/admin/*` y `/api/auth/*` usando la cookie de sesión.
4. Cada escritura: sesión válida → CSRF → Zod → transacción (update + revisión + auditoría)
   → respuesta. La caché CDN se renueva por `s-maxage` corto.

### Tema editable

Hoy los colores están hardcodeados como clases Tailwind (`purple-*`, `violet-*`, ~50 usos)
y `ink` en hex. En `tailwind.config.js` se redefinen esas escalas como
`rgb(var(--c-purple-400) / <alpha-value>)`, de modo que las clases existentes pasan a ser
editables sin tocar componentes. El panel edita pocos colores base (`#rrggbb`); el servidor
deriva las escalas y entrega las variables. Colores fijos dentro de la escena Three.js se
leen de las mismas variables al montar.

## 4. Autenticación

### Google OAuth (Authorization Code + PKCE)

1. `GET /api/auth/google/start` genera `state`, `nonce` y `code_verifier` (32 bytes
   aleatorios cada uno), guarda `sha256(state)` + verifier + nonce en `oauth_flows`
   (expira en 5 min) y redirige a Google con `code_challenge` S256.
2. `GET /api/auth/google/callback` busca y **borra** el flujo por `sha256(state)`
   (un solo uso), intercambia el código y valida el `id_token`: firma (JWKS de Google),
   `iss`, `aud`, `exp`, `nonce`.
3. Acepta solo si `email === ADMIN_EMAIL` y `email_verified === true`. En el primer login
   exitoso se guarda `sub` en `admin_identity`; después se exige `sub` idéntico.
4. Rechazos: respuesta genérica, evento en auditoría.
5. `OAUTH_REDIRECT_URI` es fijo al dominio de producción.

### Sesión

- Cookie `__Host-session`: `HttpOnly; Secure; SameSite=Strict; Path=/`, sin `Domain`.
- Valor: token aleatorio de 256 bits. En BD solo `sha256(token)`.
- Tipo `full`: vida absoluta 8 h, inactividad 30 min.
- Tipo `recovery`: vida 15 min, solo permite vincular Google de nuevo y regenerar códigos.
- Se rota el token al iniciar sesión. Logout y "cerrar todas las sesiones".

### CSRF

- `SameSite=Strict` más token CSRF sincronizado (ligado a la sesión, enviado en header
  `X-CSRF-Token`) en todo método no seguro.
- Verificación de `Origin` (o `Referer` si falta) igual a `APP_ORIGIN`.

### Códigos de recuperación

- Generación (solo con sesión `full`): 10 códigos de 12 caracteres en alfabeto
  Crockford base32 (~60 bits), formato `XXXX-XXXX-XXXX`. Se hashean con argon2id
  (memoria 19 MiB, t=2) y se muestran **una sola vez**. Regenerar invalida los anteriores.
- Uso: `POST /api/auth/recovery` con el código; se normaliza, se compara contra los hashes
  no usados, se marca `used_at` en la misma transacción y se crea sesión `recovery`.
- Rate limit: 5 intentos/hora por IP y bloqueo global progresivo tras 10 fallos
  (15 min, 1 h, 24 h).
- Todo intento queda auditado; el panel muestra eventos recientes al entrar.

## 5. Modelo de datos

| Tabla | Campos |
|---|---|
| `admin_identity` | `id`, `email`, `google_sub` (nullable hasta el primer login), `created_at` |
| `sessions` | `id`, `token_hash` (único), `csrf_secret`, `kind`, `created_at`, `last_seen_at`, `expires_at`, `ip_hash`, `user_agent` |
| `oauth_flows` | `state_hash` (PK), `code_verifier`, `nonce`, `expires_at` |
| `recovery_codes` | `id`, `code_hash`, `created_at`, `used_at` |
| `rate_limits` | `key` (PK), `count`, `window_start`, `failures`, `locked_until` |
| `translations` | `id` (fila única), `data` jsonb, `version`, `updated_at` |
| `theme` | `id` (fila única), `data` jsonb, `version`, `updated_at` |
| `projects` | `id` uuid, `position`, `title`, `description_en`, `description_es`, `image_url`, `tech` text[], `live_url`, `github_url`, `published`, `created_at`, `updated_at` |
| `content_revisions` | `id`, `entity`, `data` jsonb, `created_at` (se conservan 30 por entidad) |
| `audit_log` | `id`, `event`, `ip_hash`, `user_agent`, `meta` jsonb, `created_at` |

- Las IPs se guardan como `HMAC-SHA256(IP_HASH_SECRET, ip)`.
- Expirados de `sessions`, `oauth_flows` y `rate_limits` se limpian de forma perezosa en
  cada operación relevante (sin cron).

## 6. API

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/content` | público, cacheado |
| GET | `/api/auth/google/start` | público, rate limit |
| GET | `/api/auth/google/callback` | público, rate limit |
| POST | `/api/auth/recovery` | público, rate limit estricto |
| POST | `/api/auth/logout` | sesión |
| GET | `/api/admin/me` | sesión (devuelve tipo de sesión y token CSRF) |
| GET/PUT | `/api/admin/translations` | `full` |
| GET/POST | `/api/admin/projects` | `full` |
| PUT/DELETE | `/api/admin/projects/:id` | `full` |
| PUT | `/api/admin/projects/order` | `full` |
| GET/PUT | `/api/admin/theme` | `full` |
| GET | `/api/admin/revisions/:entity` | `full` |
| POST | `/api/admin/revisions/:id/restore` | `full` |
| GET | `/api/admin/security/audit` | `full` |
| GET/DELETE | `/api/admin/security/sessions` | `full` |
| POST | `/api/admin/security/recovery-codes` | `full` o `recovery` |

- `/api/admin/*` sin sesión válida, o con sesión sin permiso para esa ruta, responde
  **404** con el mismo cuerpo que una ruta inexistente.
- Fuera de producción (`VERCEL_ENV !== 'production'`) todo `/api/admin/*` y
  `/api/auth/*` responde 404.
- Escrituras con `version` optimista: si no coincide, 409.

## 7. Validación (Zod, `.strict()` en todos los objetos)

- **Traducciones:** esquema derivado de las claves de `defaults.js`; claves desconocidas
  rechazadas; cada valor string de 1 a 500 caracteres; sin caracteres de control.
- **Tema:** cada color `^#[0-9a-fA-F]{6}$`; solo claves conocidas.
- **Proyectos:** `title` 1–80; descripciones 1–300; `image_url` `https://res.cloudinary.com/...`;
  `live_url`/`github_url` `https://` opcionales; `tech` subconjunto de la lista cerrada de
  `TechIcon`; máximo 50 proyectos.
- Body JSON obligatorio (`Content-Type: application/json`), máximo 64 KB.
- `:id` validado como UUID antes de tocar la BD.

## 8. Capas de seguridad

1. **Transporte:** HTTPS, HSTS `max-age=63072000; includeSubDomains; preload`.
2. **Headers** (`helmet` en la API, `vercel.json` en estáticos):
   - CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
     font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://res.cloudinary.com;
     connect-src 'self' https://2j5uuy7hcg.execute-api.us-east-1.amazonaws.com; frame-ancestors 'none'; object-src 'none';
     base-uri 'none'; form-action 'self' https://accounts.google.com`.
     `'unsafe-inline'` solo en estilos (MUI/Emotion). La lista final se ajusta tras probar
     que el sitio actual (Three.js, fuentes, chatbot) funciona.
   - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
     `Permissions-Policy` restrictiva, `Cross-Origin-Opener-Policy: same-origin`,
     `Cross-Origin-Resource-Policy: same-origin`. Panel con `X-Robots-Tag: noindex, nofollow`.
3. **Entrada:** Zod estricto, límite de body, `x-powered-by` deshabilitado,
   `trust proxy` configurado para Vercel.
4. **Autorización:** `requireAdmin` aplicado una sola vez al router `/api/admin`.
5. **Rate limiting en Postgres:** login 10/min/IP, recuperación 5/h/IP + bloqueo global,
   escrituras admin 60/min.
6. **Errores y logs:** respuestas genéricas sin stack ni mensajes de BD; ID de request;
   logs estructurados sin tokens, cookies ni códigos.
7. **Secretos:** solo en env de Vercel marcadas *Sensitive*; validadas al arrancar;
   `.env` fuera de git; `gitleaks` en CI. `ADMIN_PATH` nunca se commitea.
8. **Base de datos:** TLS obligatorio; rol de aplicación con solo `SELECT/INSERT/UPDATE/DELETE`
   sobre sus tablas; migraciones con rol separado.
9. **Supply chain:** `npm ci`, `npm audit --audit-level=high` en CI, CodeQL, Dependabot,
   Actions fijadas por SHA, dependencias mínimas.
10. **Respuesta a incidentes:** historial de revisiones con restauración en un clic;
    "cerrar todas las sesiones"; Attack Challenge Mode de Vercel documentado.

## 9. Testing

Backend con TDD: Vitest + Supertest, Postgres en memoria con PGlite (sin Neon), Google
mockeado a nivel de servicio (JWKS de prueba).

Casos obligatorios:

- Toda ruta `/api/admin/*` sin sesión → 404 idéntico a ruta inexistente.
- Sesión `recovery` en ruta de contenido → 404.
- Escritura sin token CSRF o con `Origin` ajeno → 403.
- `email_verified: false`, email distinto, `sub` distinto, `nonce`/`state` inválido o reutilizado → rechazo.
- Payloads de inyección SQL (`'; DROP TABLE projects; --`, etc.) se guardan como texto
  literal o se rechazan por Zod, y las tablas siguen intactas.
- Claves desconocidas, colores inválidos, URLs `javascript:` / `http:` / otro host → 400.
- Código de recuperación: funciona una vez, segundo uso falla, regenerar invalida anteriores.
- Rate limit y bloqueo progresivo se activan en los umbrales.
- Expiración absoluta y por inactividad de sesión.
- `version` desactualizada → 409.
- Fuera de producción, `/api/admin/*` → 404.
- `GET /api/content` devuelve solo proyectos publicados y headers de caché correctos.

Frontend: `npm run build`, `npm run lint` y prueba manual del panel y del sitio público.

## 10. Flujo de trabajo Git

- Rama `feat/admin-cms`; nada directo a `main`.
- Conventional Commits en español, atómicos, cada uno compila y pasa tests.
  Tipos: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`, `security`.
- PR con descripción completa (cambios, pruebas, modelo de seguridad, variables de entorno).
  Merge y push solo con autorización explícita.
- CI en GitHub Actions: lint, tests, build, `npm audit`, gitleaks, CodeQL; Dependabot.
- Recomendado al dueño: protección de `main` (PR obligatorio + CI en verde).

## 11. Variables de entorno

| Variable | Dónde | Notas |
|---|---|---|
| `DATABASE_URL` | Vercel (Sensitive) | rol de aplicación, `sslmode=require` |
| `DATABASE_URL_MIGRATIONS` | local / CI de migraciones | rol con DDL, nunca en runtime |
| `GOOGLE_CLIENT_ID` | Vercel | |
| `GOOGLE_CLIENT_SECRET` | Vercel (Sensitive) | |
| `OAUTH_REDIRECT_URI` | Vercel | dominio de producción |
| `ADMIN_EMAIL` | Vercel | `jonnhyortega@gmail.com` |
| `APP_ORIGIN` | Vercel | origen de producción |
| `IP_HASH_SECRET` | Vercel (Sensitive) | 32 bytes aleatorios |
| `ADMIN_PATH` | Vercel (Sensitive) | ruta secreta del panel; nunca en el repo |

## 12. Pasos manuales del dueño

1. Crear el cliente OAuth en Google Cloud Console con el redirect URI de producción.
2. Conectar Neon desde el Marketplace de Vercel y crear el rol de aplicación.
3. Cargar las variables de entorno en Vercel.
4. Generar los códigos de recuperación en el primer login y guardarlos offline.
5. Activar la protección de `main` en GitHub.
