/**
 * Décisions pures du garde de maintenance. Les seules routes qui traversent
 * ce garde restent responsables de leur propre authentification côté handler.
 */
export const MAINTENANCE_TECHNICAL_METHODS = new Map([
  ['/api/abonnement/fedapay', ['POST']],
  ['/api/cron/cycle-grace', ['GET', 'POST']],
  ['/api/cron/notifications', ['GET', 'POST']],
  ['/api/cron/purge', ['GET', 'POST']],
  ['/api/cron/schema', ['GET', 'POST']],
])

export const MAINTENANCE_HEADERS = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Surrogate-Control': 'no-store',
  'Retry-After': '3600',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
})

/** @param {string} method @param {string} page */
export function maintenanceResponseSpec(method, page) {
  return {
    status: 503,
    body: method === 'HEAD' ? null : page,
    headers: MAINTENANCE_HEADERS,
  }
}

/** @param {string | undefined} mode */
export function isMaintenanceEnabled(mode) {
  return mode !== 'off'
}

/** @param {string} pathname @param {string} method @param {string | undefined} mode */
export function maintenanceDecision(pathname, method, mode) {
  if (!isMaintenanceEnabled(mode)) return 'normal'

  const allowedMethods = MAINTENANCE_TECHNICAL_METHODS.get(pathname)
  return allowedMethods?.includes(method) ? 'technical' : 'maintenance'
}
