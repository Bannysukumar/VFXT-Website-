/** After a Vite deploy, old tabs keep hashed chunk URLs that 404. Reload once for a fresh index. */

const RELOAD_KEY = 'vfxt.chunkReloadAt'

export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  const name = err instanceof Error ? err.name : ''
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\w-]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(name) ||
    /ChunkLoadError/i.test(msg)
  )
}

/**
 * Hard-reload once when a stale deploy chunk is detected.
 * Returns true if a reload was triggered.
 */
export function reloadForNewDeploy(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    // Avoid infinite reload loops if the new build is also broken.
    if (last && Date.now() - last < 15_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    /* private mode */
  }
  const url = new URL(window.location.href)
  url.searchParams.set('_r', String(Date.now()))
  window.location.replace(url.toString())
  return true
}

export function handleStaleChunkError(err: unknown): boolean {
  if (!isStaleChunkError(err)) return false
  return reloadForNewDeploy()
}
