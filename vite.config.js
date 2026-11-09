import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In local development, serve the /api functions (normally run by Vercel) from the Vite server,
// with the keys from .env.local. Production is unaffected: Vercel runs the api/ folder itself.
function localApi() {
  return {
    name: 'local-api',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/([\w-]+)$/.exec((req.url || '').split('?')[0])
        if (!m) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.js`)
          const handler = mod[req.method]
          if (!handler) { res.statusCode = 405; return res.end() }
          const chunks = []
          for await (const c of req) chunks.push(c)
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method, headers: req.headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
          })
          const out = await handler(request)
          res.statusCode = out.status
          out.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await out.arrayBuffer()))
        } catch (err) {
          console.error(err)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Local API error' }))
        }
      })
    },
  }
}

export default defineConfig({ plugins: [react(), localApi()] })
