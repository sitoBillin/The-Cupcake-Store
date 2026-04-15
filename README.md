# The Cupcake Store

UI para ChartMuseum. Aplicación en **React** y **TypeScript**, empaquetada con **Vite**.

## Requisitos

- Node.js **20** (recomendado: `nvm use` con `.nvmrc`)

## Comandos

```bash
npm install
npm run dev
```

- `npm run build` — compilación para producción
- `npm run preview` — vista previa del build
- `npm run lint` — ESLint

## ChartMuseum

La aplicación usa la [API de ChartMuseum](https://chartmuseum.com/docs/#helm-chart-repository): `GET /api/charts` para listar y `DELETE /api/charts/<name>/<version>` para borrar una versión.

Variables en `.env` (plantilla en `.env.example`):

| Variable | Descripción |
| -------- | ----------- |
| `CHARTMUSEUM_BASE_URL` | Origen del servidor (sin barra final), p. ej. `https://charts.ejemplo.com` |
| `CHARTMUSEUM_USER` | Usuario Basic Auth (vacío si no aplica) |
| `CHARTMUSEUM_PASSWORD` | Contraseña Basic Auth |
| `CHARTMUSEUM_REPO_PATH` | Solo multitenancy: ruta tras `/api`, p. ej. `org1/repoa` |

**Importante:** usuario y contraseña **no** van al bundle del navegador. Vite actúa como **proxy** en `npm run dev` y `npm run preview`, inyectando `Authorization: Basic …` hacia ChartMuseum. En un despliegue estático en producción hará falta un proxy similar (nginx, API gateway, etc.) si el museo exige autenticación.
