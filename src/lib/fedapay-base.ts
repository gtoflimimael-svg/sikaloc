// Garde de l'adresse d'API FedaPay de test (FN-01). Module pur, testable.

/**
 * Adresse d'API de remplacement, pour les tests de bout en bout (FN-01).
 *
 * Acceptée uniquement si elle désigne la machine locale (127.0.0.1, ::1,
 * localhost) : un faux FedaPay de test ne peut jamais remplacer l'API réelle
 * vers un hôte tiers, même si la variable était mal renseignée en production.
 */
export function baseApiRemplacement(valeur: string | undefined): string | null {
  if (!valeur) return null
  try {
    const url = new URL(valeur)
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        url.username || url.password || url.search || url.hash) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}
