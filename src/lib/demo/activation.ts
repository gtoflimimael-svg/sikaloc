/**
 * La démo est disponible seulement avec une activation explicite en
 * développement, sur l'ordinateur local. Ne pas ajouter de préfixe NEXT_PUBLIC_:
 * cette décision doit rester côté serveur.
 */
export function demonstrationLocaleAutorisee(hote: string | null | undefined): boolean {
  if (process.env.NODE_ENV !== 'development' || process.env.SIKALOC_DEMO_LOCAL !== '1') {
    return false
  }

  const valeur = hote?.trim().toLowerCase()
  if (!valeur) return false

  const hoteSansPort = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(valeur)
  const correspondance = valeur.match(/^(localhost|127\.0\.0\.1|\[::1\]):(\d{1,5})$/)
  const portLocalValide = correspondance
    ? Number(correspondance[2]) > 0 && Number(correspondance[2]) <= 65535
    : false

  return hoteSansPort || portLocalValide
}
