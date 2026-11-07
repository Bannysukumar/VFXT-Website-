/**
 * Production static SPA server with security headers (aaPanel / pm2).
 * `serve -s` does not set CSP / frame options — use this instead.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const dist = path.join(root, 'dist')
const port = Number(process.env.PORT || 3029)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.google.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.walletconnect.com wss://*.walletconnect.com; frame-src https://www.google.com https://*.firebaseapp.com https://verify.walletconnect.com https://verify.walletconnect.org; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers })
  res.end(body)
}

function safeJoin(base, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0] || '/')
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const full = path.join(base, cleaned)
  if (!full.startsWith(base)) return null
  return full
}

const server = http.createServer((req, res) => {
  const urlPath = req.url || '/'
  // Never expose client source maps in production.
  if (/\.map(\?|$)/i.test(urlPath)) {
    send(res, 404, 'Not found')
    return
  }
  let filePath = safeJoin(dist, urlPath === '/' ? '/index.html' : urlPath)
  if (!filePath) {
    send(res, 400, 'Bad request')
    return
  }

  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        // SPA fallback
        fs.readFile(path.join(dist, 'index.html'), (htmlErr, html) => {
          if (htmlErr) {
            send(res, 404, 'Not found')
            return
          }
          send(res, 200, html, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          })
        })
        return
      }

      const ext = path.extname(filePath).toLowerCase()
      const type = MIME[ext] || 'application/octet-stream'
      const cache =
        urlPath.startsWith('/assets/')
          ? 'public,max-age=31536000,immutable'
          : ext === '.html'
            ? 'no-cache'
            : 'public,max-age=3600'
      send(res, 200, data, { 'Content-Type': type, 'Cache-Control': cache })
    })
  })
})

server.listen(port, () => {
  console.log(`VFXT SPA listening on :${port} (dist=${dist})`)
})
