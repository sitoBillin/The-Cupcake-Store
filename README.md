<p align="center">
  <img src="./public/cupcake-logo.svg" width="104" height="104" alt="The Cupcake Store: logotipo de cupcake" />
</p>

# The Cupcake Store

UI para [ChartMuseum](https://chartmuseum.com) con **React**, **TypeScript** y **Vite 5**.

## Ejemplo de captura

Tabla de versiones con filtro por chart, detalle expandido (descripción, publicado, digest, URLs) y panel **Últimas publicaciones**.

![Captura de pantalla de The Cupcake Store: tabla tortilla, detalle abierto y barra lateral](./docs/cupcake-store-screenshot.png)

## Requisitos

- Node.js **24.22.0** (`.nvmrc`), última LTS de la serie 24

## Comandos

```bash
npm install
npm run dev
```

| Comando | Descripción |
| ------- | ----------- |
| `npm run build` | Compilación para producción |
| `npm run preview` | Vista previa del build (mismo proxy que en dev) |
| `npm run lint` | ESLint |
| `npm start` | Servidor de producción (`server/server.mjs`) sobre `dist/`, con login de Google |

## Configuración

La app llama a **`/chartmuseum/api/...`** en el mismo origen; en **`npm run dev`** y **`npm run preview`**, Vite hace de **proxy** hacia `CHARTMUSEUM_BASE_URL` e inyecta Basic Auth desde el `.env` (las credenciales no van al bundle del navegador).

Copia [`.env.example`](./.env.example) a `.env` y ajusta los valores:

| Variable | Descripción |
| -------- | ----------- |
| `PORT` | Puerto de dev/preview (opcional; por defecto 5173) |
| `CHARTMUSEUM_BASE_URL` | Origen del ChartMuseum **sin** barra final y **sin** `/api` (el proxy ya usa `/api/charts`) |
| `CHARTMUSEUM_USER` / `CHARTMUSEUM_PASSWORD` | Basic Auth (opcional) |
| `CHARTMUSEUM_REPO_PATH` | Multitenancy: ruta tras `/api` (opcional) |

Si falla la conexión con `localhost`, prueba `127.0.0.1` en la URL base.

**HTML en lugar de JSON:** revisa que la URL base apunte al ChartMuseum; en la terminal de `npm run dev` verás `[vite ChartMuseum] proxy → …`. Comprueba con `curl -sS -u 'USER:PASS' 'TU_URL/api/charts' | head -c 120` (debe ser JSON).

## Despliegue y login con Google

Desplegada, la app la sirve `server/server.mjs` (Node 24, sin dependencias). El `Dockerfile` construye `dist/` y arranca ese servidor como usuario `node` en el puerto 8080.

El servidor hace lo mismo que el login de Google de Grafana, más la comprobación de grupo que Tortilla hace para Gofrera:

1. Sin sesión, redirige a Google (OAuth 2.0 con PKCE, `state` y `nonce`, `hd=billin.eu`).
2. En `/auth/callback` canjea el código, exige `email_verified` y dominio `ALLOWED_DOMAIN`.
3. Con el token del propio usuario consulta la Cloud Identity API (`groups:lookup` y `memberships:lookup`). Solo entra si es miembro directo de `ALLOWED_GROUP` (`backoffice@billin.eu`). Cualquier otro resultado deniega el acceso.
4. Guarda una cookie de sesión firmada (`HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS) que dura `SESSION_TTL_SECONDS` (1 hora por defecto). Al caducar, el navegador vuelve a pasar por Google sin pedir nada si la sesión de Google sigue abierta.

`/chartmuseum/api/charts...` solo acepta `GET`, `HEAD` y `DELETE`, y el `DELETE` exige el `Origin` de `PUBLIC_URL`. El servidor añade `CHARTMUSEUM_USER` / `CHARTMUSEUM_PASSWORD` mientras ChartMuseum tenga basic auth; cuando se quite, se dejan vacías. Los borrados quedan en el log con el email de quien los hace.

`/health` responde sin sesión, para las probes.

Requisitos en Google Cloud (proyecto del cliente OAuth):

- Cloud Identity API (`cloudidentity.googleapis.com`) activada.
- Cliente OAuth de tipo **aplicación web**, con redirect `PUBLIC_URL/auth/callback` (por ejemplo `https://cupcake.dev.k8s.billin.net/auth/callback` y `http://localhost:3500/auth/callback`).
- Pantalla de consentimiento interna, con los scopes `openid`, `email` y `https://www.googleapis.com/auth/cloud-identity.groups.readonly`.
