import http from 'node:http'
import https from 'node:https'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import {
  CHARTMUSEUM_DOTENV_KEYS,
  readChartmuseumEnvStrings,
} from './src/env/chartmuseumEnvNames.ts'

/** Evita ECONNREFUSED en algunos equipos donde `localhost` prioriza IPv6 (::1) y el servidor solo escucha en IPv4. */
function outboundAgentForTarget(target: string) {
  return target.startsWith('https')
    ? new https.Agent({ family: 4 })
    : new http.Agent({ family: 4 })
}

/** Evita doble `/api` si alguien pone `…/api` como base (ChartMuseum expone `…/api/charts`). */
function normalizeChartmuseumBaseUrlForProxy(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '')
  if (/\/api$/i.test(base)) {
    console.warn(
      `[vite ChartMuseum] ${CHARTMUSEUM_DOTENV_KEYS.baseUrl} terminaba en /api; se eliminó ese sufijo (el proxy ya pide /api/charts).`,
    )
    base = base.replace(/\/api$/i, '')
  }
  return base.replace(/\/+$/, '')
}

function joinUrlForLog(origin: string, reqPath: string): string {
  const o = origin.replace(/\/+$/, '')
  const p = reqPath.startsWith('/') ? reqPath : `/${reqPath}`
  return o + p
}

function chartmuseumProxyConfig(env: Record<string, string>): Record<string, ProxyOptions> {
  const cm = readChartmuseumEnvStrings(env)
  const baseUrl = normalizeChartmuseumBaseUrlForProxy(cm.baseUrl)
  if (!baseUrl) {
    return {}
  }

  const user = cm.user
  const password = cm.password
  const repoPath = cm.repoPath.replace(/^\/+|\/+$/g, '')

  const authHeader =
    user || password
      ? `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`
      : undefined

  const rewritePath = (path: string): string => {
    let p = path.replace(/^\/chartmuseum/, '') || '/'
    if (repoPath && p.startsWith('/api/')) {
      p = p.replace(/^\/api\//, `/api/${repoPath}/`)
    }
    return p
  }

  const agent = outboundAgentForTarget(baseUrl)
  let loggedFirstProxy = false

  return {
    '/chartmuseum': {
      target: baseUrl,
      changeOrigin: true,
      agent,
      rewrite: rewritePath,
      configure(proxy) {
        proxy.on('proxyReq', (proxyReq) => {
          if (authHeader) {
            proxyReq.setHeader('Authorization', authHeader)
          }
          if (!loggedFirstProxy) {
            loggedFirstProxy = true
            const path = proxyReq.path ?? ''
            const resolved = joinUrlForLog(baseUrl, path)
            console.info(`[vite ChartMuseum] proxy → ${resolved}`)
            console.info(
              `[vite ChartMuseum] comprueba JSON: curl -sS -u 'USER:PASS' '${joinUrlForLog(baseUrl, '/api/charts')}' | head -c 120`,
            )
          }
        })
        proxy.on('error', (err) => {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(
            `\n[vite ChartMuseum proxy] ${msg}`,
            `\n  Destino configurado: ${baseUrl}`,
            `\n  ¿ChartMuseum en marcha y puerto correcto? Prueba curl "${baseUrl}/health".`,
            `\n  Si sigue fallando con localhost, prueba 127.0.0.1 en ${CHARTMUSEUM_DOTENV_KEYS.baseUrl}.\n`,
          )
        })
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number.parseInt(env.PORT ?? '', 10)
  const serverPort = Number.isFinite(port) && port > 0 ? port : 5173
  const proxy = chartmuseumProxyConfig(env)

  return {
    plugins: [react()],
    server: {
      port: serverPort,
      proxy,
    },
    preview: {
      port: serverPort,
      proxy,
    },
  }
})
