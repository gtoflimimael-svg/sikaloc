import * as Sentry from '@sentry/nextjs'

// Point d'entrée d'observabilité de Next.js (OPS-01).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}

// Erreurs des Server Components, Server Actions, routes et du proxy.
export const onRequestError = Sentry.captureRequestError
