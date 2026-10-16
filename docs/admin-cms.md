# Panel de administración: configuración y despliegue

Guía de los pasos manuales para poner en producción el panel secreto del portfolio.
El diseño completo está en `docs/superpowers/specs/2026-10-16-admin-cms-design.md`.

> El valor real de `ADMIN_PATH` (tu ruta secreta) **nunca** se escribe en el repo, en
> commits, issues ni capturas. Vive solo en las variables de entorno de Vercel.

## 1. Variables de entorno

| Variable | Dónde | Notas |
|---|---|---|
| `DATABASE_URL` | Vercel (Sensitive) | Rol de aplicación `portfolio_app`, con `sslmode=require`. |
| `DATABASE_URL_MIGRATIONS` | Solo local | Rol propietario (con DDL). Nunca en Vercel ni en runtime. |
| `DEV_DATABASE_URL` | Solo local | Base de desarrollo para `DEV_FAKE_SESSION`. Debe ser distinta de `DATABASE_URL`; `pglite:memory` usa una BD en memoria. |
| `GOOGLE_CLIENT_ID` | Vercel | Del cliente OAuth. |
| `GOOGLE_CLIENT_SECRET` | Vercel (Sensitive) | Del cliente OAuth. |
| `OAUTH_REDIRECT_URI` | Vercel | `https://www.jonnhyortegadev.com/api/auth/google/callback` |
| `ADMIN_EMAIL` | Vercel | Único email autorizado. |
| `APP_ORIGIN` | Vercel | `https://www.jonnhyortegadev.com` |
| `IP_HASH_SECRET` | Vercel (Sensitive) | 32 bytes aleatorios. |
| `PANEL_RETURN_SECRET` | Vercel (Sensitive) | 32 bytes aleatorios; firma la cookie de retorno del login. |
| `ADMIN_PATH` | Vercel (Sensitive) | Tu ruta secreta del panel, por ejemplo `/algo-largo-y-aleatorio`. Ver formato abajo. |
| `VITE_API_URL` | Vercel | Ya existía (chatbot). |

Generar un secreto aleatorio (para `IP_HASH_SECRET`, `PANEL_RETURN_SECRET` y una ruta
difícil de adivinar):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Usa un valor distinto para cada variable. Para `ADMIN_PATH`, antepone `/`.

**Formato de `ADMIN_PATH`:** debe cumplir `^/[A-Za-z0-9_-]{8,}$` (una `/` y al menos 8
letras, dígitos, `_` o `-`; sin más barras, puntos ni espacios) y no puede empezar por
`/api` ni `/assets`. Si no lo cumple, la middleware lo ignora por completo y el panel no
existe (falla cerrado). Una ruta corta como `/mi-panel` (9 caracteres) se acepta, pero
se recomienda una larga y aleatoria como la que genera el comando anterior
(`base64url` solo usa caracteres válidos; si por azar empieza por `api` o `assets`, genera otra).

**Un solo host:** `APP_ORIGIN`, `OAUTH_REDIRECT_URI` y los orígenes y URI de redirección de
Google Cloud Console deben usar exactamente el mismo host (`www.jonnhyortegadev.com`). Las
cookies `__Host-` y la comprobación de `Origin` solo funcionan en ese host. Si alguien
abre la ruta del panel en otro host, la middleware responde un 308 al mismo path en
`APP_ORIGIN`.

## 2. Google OAuth y dominio

1. En [Google Cloud Console](https://console.cloud.google.com/) crea (o elige) un proyecto.
2. Configura la pantalla de consentimiento (tipo externo, solo tu cuenta como usuario de prueba o publicada).
3. Credenciales, Crear credenciales, **ID de cliente de OAuth**, tipo de aplicación **Web application**.
4. Orígenes de JavaScript autorizados: `https://www.jonnhyortegadev.com`
5. URI de redirección autorizados: `https://www.jonnhyortegadev.com/api/auth/google/callback`
6. Copia el ID y el secreto a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Vercel.

### Dominio canónico

En Vercel, Project Settings, Domains: configura el dominio apex (`jonnhyortegadev.com`)
para que **redirija** a `www.jonnhyortegadev.com` (no lo sirvas como un segundo host).
Así todo el tráfico llega al host de `APP_ORIGIN`, el mismo que usan `OAUTH_REDIRECT_URI`
y la consola de Google.

## 3. Base de datos (Neon)

1. En Vercel, Storage, Marketplace: instala **Neon** y conéctalo al proyecto.
2. Con el rol propietario de Neon, define `DATABASE_URL_MIGRATIONS` en tu `.env` local
   (el `.env` no se commitea).
3. Aplica el esquema y el contenido inicial:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. Ejecuta `server/db/roles.sql` con el rol propietario (consola SQL de Neon), **después**
   de migrar. Crea el rol `portfolio_app` con mínimo privilegio.
5. En la consola de Neon asigna una contraseña a `portfolio_app` y arma su cadena de
   conexión (`sslmode=require`): esa es `DATABASE_URL` en Vercel.

## 4. Cargar variables en Vercel

Project Settings, Environment Variables: carga todas las de la tabla (entorno
Production). Marca como **Sensitive** las indicadas. Redespliega para que apliquen.

## 5. Primer login y códigos de recuperación

1. Entra a `https://www.jonnhyortegadev.com` + tu ruta secreta.
2. Inicia sesión con Google (el email debe ser `ADMIN_EMAIL` y estar verificado).
   El primer login vincula tu identidad de Google al panel.
3. En la pestaña de seguridad genera los **códigos de recuperación** (10 códigos
   `XXXX-XXXX-XXXX`). Se muestran una sola vez: guárdalos fuera de línea. Regenerar
   invalida los anteriores.
4. Un código de recuperación se marca como usado al consumirse. Si la creación de la
   sesión falla justo después, ese código queda quemado: usa otro.

### Recuperar el acceso

Si perdiste el acceso a tu cuenta de Google, o cambiaste `ADMIN_EMAIL`:

1. En la pantalla de acceso del panel elige **Usar código de recuperación** e ingresa uno
   de tus códigos. Abre una sesión de recuperación de 15 minutos, que solo permite
   regenerar códigos o desvincular Google.
2. Pulsa **Desvincular Google y volver a entrar** y confirma. El servidor borra la cuenta
   de Google vinculada, fija el email al valor actual de `ADMIN_EMAIL`, registra
   `identity_reset` en la auditoría y cierra la sesión de recuperación.
3. Se abre el login con Google: la próxima cuenta con la que entres queda vinculada. Debe
   ser exactamente `ADMIN_EMAIL` y tener el email verificado.
4. Ya dentro, genera códigos de recuperación nuevos (el que usaste quedó consumido).

Si cambias `ADMIN_EMAIL` en Vercel sin desvincular antes, el login se rechaza
(`email_changed` en la auditoría): el panel nunca revincula en silencio.

## 6. Probar el panel en local

```bash
npm run dev:panel   # API de desarrollo con sesión falsa y BD en memoria
npm run dev         # sitio con Vite, en otra terminal
```

`dev:panel` imprime una cookie de sesión de desarrollo; pégala en tu navegador
(`localhost`) para entrar sin OAuth. Solo funciona fuera de producción y nunca toca
`DATABASE_URL`.

Para revisar los headers de seguridad de `vercel.json` sobre el build:

```bash
npm run preview:headers
```

## 7. Protección de `main` en GitHub

Settings, Branches, regla para `main`: exigir pull request, exigir que pasen los checks
de CI (`Lint, tests, build y audit` y `Gitleaks`) y bloquear force-push.

## 8. Respuesta a incidentes

- **Attack Challenge Mode:** Vercel, proyecto, Firewall, activar *Attack Challenge Mode*
  (desactívalo al terminar el ataque).
- **Cerrar todas las sesiones** desde la pestaña de seguridad del panel.
- **Revisiones:** el historial permite restaurar contenido anterior en un clic.

## 9. Cambiar `ADMIN_PATH`

1. Genera una nueva ruta aleatoria (comando de la sección 1).
2. Actualiza `ADMIN_PATH` en Vercel (Sensitive) y redespliega.
3. La ruta anterior deja de funcionar. No la escribas en el repo.

## 10. HSTS y subdominios

La cabecera usa `max-age=63072000; includeSubDomains; preload`. Antes de enviar el dominio
a la lista de precarga (hstspreload.org) asegúrate de que **todos** los subdominios
sirven HTTPS: quitar un dominio de la lista de precarga es lento.
