/**
 * Origine d'envoi Sentry à autoriser dans `connect-src` (OPS-01).
 * Le DSN a la forme https://clé@o123.ingest.de.sentry.io/456 ; seule l'origine
 * (sans la clé) entre dans la CSP. DSN absent ou invalide : rien n'est ajouté.
 *
 * @param {string | undefined} dsn
 * @returns {string}
 */
export function getSentryCspOrigin(dsn) {
  if (!dsn) return ''
  try {
    const url = new URL(dsn)
    if (url.protocol !== 'https:' || !/(^|\.)sentry\.io$/.test(url.hostname)) return ''
    return url.origin
  } catch {
    return ''
  }
}
