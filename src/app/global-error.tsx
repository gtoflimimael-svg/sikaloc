'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * Dernier filet : une erreur dans le layout racine remplace toute la page.
 * Elle est signalée à Sentry (OPS-01), et l'utilisateur garde une sortie.
 */
export default function ErreurGlobale({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F6F8F5', color: '#111810' }}>
        <main style={{ maxWidth: 520, padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: '0 0 12px' }}>Une erreur inattendue est survenue.</h1>
          <p style={{ lineHeight: 1.6, margin: '0 0 24px', color: '#424940' }}>
            L’incident a été signalé à l’équipe Sikaloc. Vos données ne sont pas affectées.
            {error.digest ? ` Référence : ${error.digest}.` : ''}
          </p>
          <button type="button" onClick={reset} style={{ padding: '12px 20px', borderRadius: 12, border: 0, background: '#17311C', color: '#fff', fontSize: 16, cursor: 'pointer' }}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  )
}
