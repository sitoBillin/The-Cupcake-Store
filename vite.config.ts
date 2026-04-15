import http from 'node:http'
import https from 'node:https'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

/** Evita ECONNREFUSED en algunos equipos donde `localhost` prioriza IPv6 (::1) y el servidor solo escucha en IPv4. */
function outboundAgentForTarget(target: string) {
  return target.startsWith('https')
    ? new https.Agent({ family: 4 })
    : new http.Agent({ family: 4 })
}

function chartmuseumProxyConfig(env: Record<string, string>): Record<string, ProxyOptions> {
  const baseUrl = (env.CHARTMUSEUM_BASE_URL ?? '').replace(/\/$/, '')
  if (!baseUrl) {
    return {}
  }

  const user = env.CHARTMUSEUM_USER ?? ''
  const password = env.CHARTMUSEUM_PASSWORD ?? ''
  const repoPath = (env.CHARTMUSEUM_REPO_PATH ?? '').replace(/^\/+|\/+$/g, '')

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
        })
        proxy.on('error', (err) => {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(
            `\n[vite ChartMuseum proxy] ${msg}`,
            `\n  Destino configurado: ${baseUrl}`,
            `\n  ¿ChartMuseum en marcha y puerto correcto? Prueba curl "${baseUrl}/health".`,
            `\n  Si sigue fallando con localhost, usa 127.0.0.1 en CHARTMUSEUM_BASE_URL.\n`,
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
