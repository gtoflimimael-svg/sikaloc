import 'server-only'

import { cookies } from 'next/headers'

/**
 * Le témoin qui porte l'adresse en attente de vérification.
 *
 * ─── Pourquoi un témoin, et pas l'URL ───────────────────────────────────────
 *
 * `verifyOtp` a besoin de l'adresse en même temps que du code, et il n'y a pas
 * encore de session pour la porter : GoTrue n'en ouvre une qu'après la
 * validation. L'adresse doit donc survivre entre l'inscription et la saisie.
 *
 * Dans l'URL, elle finirait dans l'historique du navigateur, dans les journaux
 * du serveur et dans l'en-tête `Referer` envoyé à tout tiers. Le témoin est
 * `httpOnly` : aucun script de la page ne le lit.
 *
 * ─── Pourquoi dans son propre fichier ──────────────────────────────────────
 *
 * Tout ce qu'exporte un module `'use server'` devient appelable depuis le
 * navigateur. Ces trois fonctions n'ont aucune raison de l'être : elles vivent
 * donc ici, derrière `server-only`.
 *
 * Vingt-quatre heures, pour qu'on puisse fermer l'onglet et revenir le
 * lendemain. Passé ce délai, l'écran redemande l'adresse.
 */
const TEMOIN_EMAIL = 'sikaloc_verification_email'
const DUREE_TEMOIN = 60 * 60 * 24

export async function poserTemoinVerification(email: string): Promise<void> {
  const boite = await cookies()
  boite.set(TEMOIN_EMAIL, email.trim().toLowerCase(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DUREE_TEMOIN,
  })
}

export async function lireTemoinVerification(): Promise<string | null> {
  const boite = await cookies()
  return boite.get(TEMOIN_EMAIL)?.value ?? null
}

export async function retirerTemoinVerification(): Promise<void> {
  const boite = await cookies()
  boite.delete(TEMOIN_EMAIL)
}
