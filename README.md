# The Cupcake Store

Interfaz web para gestionar y explorar un repositorio [ChartMuseum](https://chartmuseum.com): listado de charts y versiones, filtros, ordenación, paginación, panel de **últimas publicaciones**, detalle por fila y eliminación de una versión con confirmación en modal.

Stack: **React**, **TypeScript** y **Vite 5**.

---

## Capturas e ilustraciones

Las imágenes siguientes son **diagramas esquemáticos** del layout y los flujos principales (SVG en el repo). Si quieres sustituirlas por capturas reales de tu entorno, reemplaza los archivos en [`docs/readme/`](./docs/readme/) o enlaza tus propias rutas.

### Vista general: filtros, tabla, icono de ojo y panel lateral

![Vista general: cabecera con marca, filtros por chart y texto, tabla con columnas ordenables, icono de ojo para el detalle, paginación y panel de últimas publicaciones](./docs/readme/app-overview.svg)

### Detalle expandido: descripción, fichas y eliminar

Al pulsar el **icono de ojo** en una fila se despliega un panel con descripción, fecha de publicación (`created`), enlace **home**, **digest**, lista de **URLs del paquete** y el botón para abrir el flujo de borrado.

![Panel de detalle con secciones en tarjetas y acción Eliminar esta versión](./docs/readme/row-detail.svg)

### Modal de confirmación al eliminar

La eliminación **no** usa `window.confirm`: se muestra un diálogo con **Cancelar** / **Eliminar**, cierre con **Escape** y bloqueo de scroll mientras está abierto.

![Modal Confirmar eliminación con fondo semitransparente](./docs/readme/delete-modal.svg)

---

## Funcionalidades

| Área | Qué hace |
| ---- | -------- |
| **Datos** | Carga el índice desde la API de ChartMuseum (`GET /api/charts`) vía proxy de Vite en desarrollo y preview. |
| **Cabecera** | Marca con logo, título y botón **Actualizar** para volver a cargar el índice. |
| **Filtro por chart** | Selector con todos los charts del índice; **tortilla**, **gofre** y **gofrera** aparecen primero en la lista; por defecto **tortilla**. Opción **Todos los charts**. |
| **Búsqueda en texto** | Filtra por coincidencia en nombre de chart, versión y descripción. |
| **Limpiar filtros** | Restablece chart a tortilla y vacía la búsqueda (deshabilitado si no hay cambios respecto al estado por defecto). |
| **Tabla** | Columnas **Chart**, **Versión** (pastilla), **Creado** (fechas amigables en español: Hoy, Ayer, día de la semana, etc.). Sin columna de descripción en la tabla para mantener la vista compacta. |
| **Ordenación** | Cabeceras clicables para ordenar por chart, versión o fecha de creación; indicador de dirección asc/desc. |
| **Detalle (ojo)** | Una sola fila expandida a la vez; panel con layout en secciones y tarjetas. |
| **Eliminar** | Solo desde el panel de detalle; llama a `DELETE /api/charts/<name>/<version>` tras confirmar en el modal. |
| **Paginación** | Cliente: tamaños 10 / 25 / 50 / 100; **Anterior** / **Siguiente** y estado de página en la misma fila que **Por página**. Al cambiar filtros, orden o tamaño de página se cierra el detalle abierto. |
| **Panel lateral** | **Últimas publicaciones**: por cada chart con fechas `created`, muestra la versión más reciente por fecha y la **anterior por fecha**; orden fijo al inicio para **tortilla**, **gofre** y **gofrera**, luego el resto por fecha de última publicación. |
| **Errores** | Mensaje visible si falla la carga o el borrado, con pista sobre `.env` y reinicio del servidor de desarrollo. |
| **Tema** | Respeta `prefers-color-scheme` (claro / oscuro) con variables CSS. |

---

## Requisitos

- **Node.js 20** (recomendado: `nvm use` con [`.nvmrc`](./.nvmrc))

## Comandos

```bash
npm install
npm run dev
```

| Comando | Descripción |
| ------- | ----------- |
| `npm run dev` | Servidor de desarrollo (puerto configurable con `PORT` en `.env`, por defecto **5173**). |
| `npm run build` | Compilación para producción (`tsc` + `vite build`). |
| `npm run preview` | Sirve el build localmente **con el mismo proxy** que en desarrollo (útil para probar Basic Auth sin exponer credenciales al bundle). |
| `npm run lint` | ESLint. |

---

## Configuración y ChartMuseum

La app usa la [API de ChartMuseum](https://chartmuseum.com/docs/#helm-chart-repository): listado con `GET /api/charts` y borrado con `DELETE /api/charts/<name>/<version>`.

Copia [`.env.example`](./.env.example) a `.env` y ajusta los valores:

| Variable | Descripción |
| -------- | ----------- |
| `PORT` | Puerto del servidor de Vite en `dev` y `preview` (opcional; si no se define, Vite usa **5173**). |
| `CHARTMUSEUM_BASE_URL` | Origen del servidor ChartMuseum **sin** barra final, por ejemplo `https://charts.ejemplo.com` o `http://127.0.0.1:8080`. |
| `CHARTMUSEUM_USER` | Usuario de Basic Auth (vacío si no aplica). |
| `CHARTMUSEUM_PASSWORD` | Contraseña Basic Auth. |
| `CHARTMUSEUM_REPO_PATH` | Solo en despliegues **multitenant**: segmento tras `/api`, por ejemplo `org1/repoa`. |

**Seguridad:** usuario y contraseña **no** se incrustan en el JavaScript del navegador. En `npm run dev` y `npm run preview`, Vite hace de **proxy** hacia ChartMuseum (`/chartmuseum` → tu `CHARTMUSEUM_BASE_URL`) e inyecta la cabecera `Authorization: Basic …` en el servidor de desarrollo.

Si sirves solo archivos estáticos del `dist` en producción, necesitarás un **proxy equivalente** (nginx, API gateway, etc.) que añada la autenticación hacia ChartMuseum.

**Red:** si `localhost` resuelve a IPv6 y tu museo solo escucha en IPv4, usa `127.0.0.1` en `CHARTMUSEUM_BASE_URL` (como indica el ejemplo en `.env.example`). El proxy de Vite usa agente saliente **IPv4** para reducir errores de conexión.

---

## Estructura relevante

- [`src/App.tsx`](./src/App.tsx) — UI principal (filtros, tabla, detalle, modal, barra lateral).
- [`src/api/chartmuseum.ts`](./src/api/chartmuseum.ts) — Cliente HTTP al proxy y tipos de fila (`description`, `created`, `home`, `digest`, `urls`, etc.).
- [`vite.config.ts`](./vite.config.ts) — Proxy ChartMuseum y puerto desde `PORT`.
