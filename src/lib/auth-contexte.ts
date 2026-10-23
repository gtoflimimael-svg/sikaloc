import { cheminProtege, cheminPublic } from '@/lib/roles'

export type ContexteConnexion = 'pro' | 'me' | 'find' | 'general'

const ORIGINE_INTERNE = 'https://sikaloc.invalid'
const REFERENCE_FIND = /^[0-9a-hjkmnp-tv-z]{10}$/

export function normaliserContexteConnexion(valeur: unknown): ContexteConnexion | null {
  return valeur === 'pro' || valeur === 'me' || valeur === 'find' || valeur === 'general'
    ? valeur
    : null
}

/**
 * Les destinations de retour sont des chemins internes et connus du produit.
 * Une destination protégée reste soumise aux gardes de rôle de sa route : ce
 * filtre empêche seulement un open redirect ou un chemin arbitraire.
 */
export function normaliserSuiteConnexion(valeur: unknown): string | null {
  if (
    typeof valeur !== 'string' ||
    valeur.length > 2048 ||
    !valeur.startsWith('/') ||
    valeur.startsWith('//') ||
    /[\\\u0000-\u001f\u007f]/.test(valeur)
  ) {
    return null
  }

  let url: URL
  try {
    url = new URL(valeur, ORIGINE_INTERNE)
  } catch {
    return null
  }

  if (url.origin !== ORIGINE_INTERNE || url.hash) return null

  const chemin = url.pathname
  const candidature = chemin.match(/^\/find\/([^/]+)\/candidater$/)
  const annonce = chemin.match(/^\/find\/([^/]+)$/)
  const cheminFindValide =
    chemin === '/find' ||
    Boolean(candidature && REFERENCE_FIND.test(candidature[1])) ||
    Boolean(annonce && REFERENCE_FIND.test(annonce[1]))
  const cheminInterneProtege = cheminProtege(chemin) && !cheminPublic(chemin)
  const cheminInterneConnu =
    chemin === '/entrer' || chemin === '/questions/gestion' || cheminFindValide

  if (!cheminInterneProtege && !cheminInterneConnu) return null

  return `${url.pathname}${url.search}`
}

export function contexteDepuisSuite(suite: string | null): ContexteConnexion | null {
  if (!suite) return null

  const chemin = new URL(suite, ORIGINE_INTERNE).pathname
  if (chemin === '/me/candidatures') return 'find'
  if (chemin === '/find' || chemin.startsWith('/find/')) return 'find'
  if (chemin === '/me' || chemin.startsWith('/me/')) return 'me'
  if (chemin === '/pro' || chemin.startsWith('/pro/')) return 'pro'
  return null
}

export function destinationParDefautConnexion(contexte: ContexteConnexion): string {
  switch (contexte) {
    case 'pro':
      return '/pro/tableau-de-bord'
    case 'me':
      return '/me'
    case 'find':
      return '/find'
    default:
      return '/entrer'
  }
}

export function suitePourContexteConnexion(
  suiteBrute: unknown,
  contexte: ContexteConnexion,
): string {
  const suite = normaliserSuiteConnexion(suiteBrute)
  if (!suite) return destinationParDefautConnexion(contexte)

  const contexteSuite = contexteDepuisSuite(suite)
  if (contexteSuite && contexteSuite !== contexte) {
    return destinationParDefautConnexion(contexte)
  }

  if (contexteSuite) return suite

  // Les pages d'administration et de choix restent possibles dans le parcours
  // général, mais ne remplacent pas une destination propre à un espace.
  return contexte === 'general' ? suite : destinationParDefautConnexion(contexte)
}

export function lienConnexion(
  contexte: ContexteConnexion,
  suiteBrute?: unknown,
): string {
  const params = new URLSearchParams({
    context: contexte,
    suite: suitePourContexteConnexion(suiteBrute, contexte),
  })
  return `/connexion?${params.toString()}`
}

export function lienMotDePasseOublie(
  contexte: ContexteConnexion,
  suiteBrute?: unknown,
): string {
  const params = new URLSearchParams({
    context: contexte,
    suite: suitePourContexteConnexion(suiteBrute, contexte),
  })
  return `/mot-de-passe-oublie?${params.toString()}`
}
