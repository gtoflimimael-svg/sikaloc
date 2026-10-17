/**
 * Les deux liens de retour d'une notification de candidature.
 *
 * Une seule source pour l'email (S8-D) et le WhatsApp (S8-F), sur la même base
 * d'URL que le reste du projet — `NEXT_PUBLIC_SITE_URL`, jamais une variable
 * improvisée.
 *
 * Le lien du bailleur porte l'identifiant INTERNE de l'annonce : c'est
 * l'adresse de sa page de candidatures, elle ne s'écrit pas autrement. Il ne
 * doit jamais figurer dans un message adressé au candidat.
 */

function urlBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/** Où le candidat retrouve ses candidatures. */
export function urlMesCandidatures(): string {
  return `${urlBase()}/me/candidatures`
}

/** Où le bailleur lit les candidatures d'une annonce. */
export function urlCandidaturesPro(annonceId: unknown): string {
  const id = String(annonceId ?? '')
  return /^[0-9a-f-]{36}$/i.test(id)
    ? `${urlBase()}/pro/annonces/${id}/candidatures`
    : `${urlBase()}/pro/annonces`
}
