import 'server-only'

import { cookies } from 'next/headers'

/**
 * Le témoin de candidature : l'annonce qu'on allait viser.
 *
 * ─── Pourquoi un témoin, et pas l'URL ──────────────────────────────────────
 *
 * Entre le clic sur « Candidater » et la candidature elle-même, il y a une
 * inscription et un code reçu par email. Ce trajet passe par `/verification`,
 * qui ne porte aucun paramètre : la référence se perdrait, et l'on
 * reviendrait sur un catalogue sans savoir ce qu'on cherchait.
 *
 * Même mécanisme que le témoin d'invitation (`lib/verification/temoin.ts`),
 * avec un enjeu bien moindre : une référence d'annonce est publique. Elle est
 * relue avec méfiance malgré tout — format vérifié — et ne donne aucun droit :
 * la candidature est refaite depuis la session, et la base revalide l'annonce.
 *
 * Une heure : le temps de relever ses mails et de recopier six chiffres.
 */
const TEMOIN_CANDIDATURE = 'sikaloc_candidature'
const DUREE = 60 * 60
const REFERENCE = /^[0-9a-hjkmnp-tv-z]{10}$/

export async function poserTemoinCandidature(reference: string): Promise<void> {
  if (!REFERENCE.test(reference)) return
  const boite = await cookies()
  boite.set(TEMOIN_CANDIDATURE, reference, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DUREE,
  })
}

export async function lireTemoinCandidature(): Promise<string | null> {
  const boite = await cookies()
  const valeur = boite.get(TEMOIN_CANDIDATURE)?.value ?? null
  return valeur && REFERENCE.test(valeur) ? valeur : null
}

export async function retirerTemoinCandidature(): Promise<void> {
  const boite = await cookies()
  boite.delete(TEMOIN_CANDIDATURE)
}
