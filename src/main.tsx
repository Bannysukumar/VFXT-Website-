import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { handleStaleChunkError } from '@/lib/chunk-reload'
import '@/index.css'

// Catch stale Vite chunks after deploy (failed dynamic imports).
window.addEventListener('unhandledrejection', (event) => {
  if (handleStaleChunkError(event.reason)) {
    event.preventDefault()
  }
})
window.addEventListener('error', (event) => {
  if (handleStaleChunkError(event.error ?? event.message)) {
    event.preventDefault()
  }
})

const root = document.getElementById('root')
if (!root) {
  throw new Error('Root element #root not found')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Hide the static HTML splash once React has painted.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const splash = document.getElementById('boot-splash')
    if (!splash) return
    splash.classList.add('is-done')
    window.setTimeout(() => splash.remove(), 300)
  })
})
