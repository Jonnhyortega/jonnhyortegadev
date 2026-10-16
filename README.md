# Portfolio de Jonnhy Ortega

Sitio personal hecho con Vite 7 y React 19, con un panel de administración secreto
(Express 5 en Vercel + Neon Postgres) para editar proyectos, traducciones y tema.

## Desarrollo

```bash
npm ci
npm run dev        # sitio
npm run dev:panel  # API de desarrollo con sesión falsa (para probar el panel)
npm run lint
npm test
npm run build
```

Requiere Node 22 o superior.

## Panel de administración

Configuración, variables de entorno y despliegue: [docs/admin-cms.md](docs/admin-cms.md).
