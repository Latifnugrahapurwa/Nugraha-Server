import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Semua request ke /api diteruskan (proxy) ke backend FastAPI,
// sehingga saat development tidak ada masalah CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PROXY_TARGET || 'http://localhost:8000'

  const proxy = {
    '/api': {
      target,
      changeOrigin: true,
    },
  }

  return {
    plugins: [react()],
    server: { host: true, port: 5173, proxy },
    preview: { host: true, port: 4173, proxy },
  }
})
