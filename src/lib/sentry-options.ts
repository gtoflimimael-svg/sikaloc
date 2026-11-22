import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs'

/**
 * Options Sentry communes (OPS-01).
 *
 * Sikaloc traite des données personnelles de bailleurs et de locataires :
 * Sentry reçoit des erreurs, jamais ces données.
 *   • `sendDefaultPii: false` : ni IP, ni cookies, ni en-têtes d'identité.
 *   • Aucun Session Replay : il enregistrerait les écrans (noms, montants…).
 *   • Aucune trace de performance (`tracesSampleRate: 0`) : les traces
 *     enregistraient l'URL complète des requêtes PostgREST, filtres compris
 *     (`email=eq.…`). Constaté en recette, d'où ce choix.
 *   • Toute chaîne de requête d'URL est effacée, emails encodés compris.
 *   • `nettoyerEvenement` retire en plus le corps des requêtes, les cookies,
 *     les en-têtes et l'utilisateur, et masque emails et téléphones dans les
 *     textes.
 * Sans DSN, `enabled` est faux : rien n'est initialisé ni envoyé.
 */

const EMAIL = /[A-Za-z0-9._%+-]+(@|%40)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi
// Numéros groupés par deux (+229 97 00 00 11, 22997000011) ; pas les dates.
const TELEPHONE = /(\+|%2B)?\b\d{2,3}(?:\s?\d{2}){3,6}\b/g
const REQUETE_URL = /(\b(?:https?|wss?):\/\/[^\s?#"']+)\?[^\s#"']*/gi

export function masquer(texte: string): string {
  return texte
    .replace(REQUETE_URL, '$1?[requête masquée]')
    .replace(EMAIL, '[email]')
    .replace(TELEPHONE, '[téléphone]')
}

export function nettoyerFil(fil: Breadcrumb): Breadcrumb {
  if (fil.message) fil.message = masquer(fil.message)
  if (fil.data) fil.data = masquerProfond(fil.data) as typeof fil.data
  return fil
}

function masquerProfond(valeur: unknown, profondeur = 0): unknown {
  if (profondeur > 5) return '[profondeur]'
  if (typeof valeur === 'string') return masquer(valeur)
  if (Array.isArray(valeur)) return valeur.map((v) => masquerProfond(v, profondeur + 1))
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(
      Object.entries(valeur).map(([cle, v]) => [cle, masquerProfond(v, profondeur + 1)]),
    )
  }
  return valeur
}

export function nettoyerEvenement(evenement: ErrorEvent): ErrorEvent {
  delete evenement.user
  if (evenement.request) {
    delete evenement.request.cookies
    delete evenement.request.headers
    delete evenement.request.data
    if (evenement.request.query_string) evenement.request.query_string = '[masqué]'
    if (evenement.request.url) evenement.request.url = masquer(evenement.request.url)
  }
  if (evenement.message) evenement.message = masquer(evenement.message)
  for (const exception of evenement.exception?.values ?? []) {
    if (exception.value) exception.value = masquer(exception.value)
  }
  if (evenement.extra) evenement.extra = masquerProfond(evenement.extra) as ErrorEvent['extra']
  for (const fil of evenement.breadcrumbs ?? []) nettoyerFil(fil)
  return evenement
}

export function optionsCommunes(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? 'local',
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: nettoyerEvenement,
    beforeBreadcrumb: nettoyerFil,
  }
}
