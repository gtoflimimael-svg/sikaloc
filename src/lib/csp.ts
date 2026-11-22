/**
 * Politique de sécurité du contenu (SEC-02).
 *
 * Les scripts ne s'exécutent que s'ils portent le nonce tiré à chaque requête
 * par le proxy : plus de `'unsafe-inline'` pour les scripts. Next.js applique
 * lui-même ce nonce à ses scripts quand il le trouve dans l'en-tête CSP de la
 * requête ; le seul script maison (anti-flash du thème) le lit via `x-nonce`.
 * `'strict-dynamic'` laisse ces scripts de confiance charger leurs morceaux.
 *
 * Les styles gardent `'unsafe-inline'` : React écrit des attributs `style`, que
 * les nonces ne couvrent pas. Une injection de style ne donne pas d'exécution
 * de code ; le risque résiduel est accepté et documenté.
 *
 * Ce module ne dépend d'aucune API Node : il tourne dans le proxy.
 */

import { getSentryCspOrigin } from './sentry-csp.mjs'
import { getSupabaseCspOrigins } from './supabase-csp.mjs'

export const EN_TETE_NONCE = 'x-nonce'

/** Pages de démonstration PDF intégrables par Sikaloc lui-même. */
const PAGES_INTEGRABLES = new Set(['/exemple-quittance', '/exemple-recu'])

export function genererNonce(): string {
  const octets = new Uint8Array(16)
  crypto.getRandomValues(octets)
  let binaire = ''
  for (const octet of octets) binaire += String.fromCharCode(octet)
  return btoa(binaire)
}

export function politiqueCsp({
  nonce,
  chemin,
  developpement = process.env.NODE_ENV === 'development',
  urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL,
  dsnSentry = process.env.NEXT_PUBLIC_SENTRY_DSN,
}: {
  nonce: string
  chemin: string
  developpement?: boolean
  urlSupabase?: string
  dsnSentry?: string
}): string {
  const { httpOrigin, websocketOrigin } = getSupabaseCspOrigins(urlSupabase)
  // Envoi des erreurs du navigateur à Sentry (OPS-01) : origine seule, sans clé.
  const sentry = getSentryCspOrigin(dsnSentry)
  const directives = [
    "default-src 'self'",
    // `unsafe-eval` en développement seulement : React s'en sert pour ses
    // piles d'erreur ; jamais en production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developpement ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${httpOrigin}`,
    "font-src 'self'",
    `connect-src 'self' ${httpOrigin} ${websocketOrigin}${sentry ? ` ${sentry}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${PAGES_INTEGRABLES.has(chemin) ? "'self'" : "'none'"}`,
    'upgrade-insecure-requests',
  ]
  return directives.join('; ')
}
