import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number.parseInt(env.PORT ?? '', 10)
  const serverPort = Number.isFinite(port) && port > 0 ? port : 5173

  return {
    plugins: [react()],
    server: {
      port: serverPort,
    },
    preview: {
      port: serverPort,
    },
  }
})
