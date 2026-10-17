import { NextResponse, type NextRequest } from 'next/server'

import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Point d'atterrissage des liens envoyés par email — RÉINITIALISATION DE MOT
 * DE PASSE UNIQUEMENT.
 *
 * ─── Ce que cette route ne fait plus ────────────────────────────────────────
 *
 * Elle confirmait aussi les inscriptions : un clic sur le lien reçu par email
 * ouvrait une session et le compte était réputé vérifié. C'est terminé. La
 * vérification passe par un code à six chiffres (`/verification`), et le
 * gabarit d'email n'envoie plus de lien de confirmation.
 *
 * ─── Pourquoi la route survit quand même ────────────────────────────────────
 *
 * La réinitialisation de mot de passe a besoin d'un lien, et c'est un besoin
 * différent : le lien ne prouve rien sur l'identité, il ouvre seulement un
 * formulaire de changement de mot de passe, lequel exige ensuite un nouveau
 * mot de passe. La supprimer casserait « mot de passe oublié ».
 *
 * ─── Le verrou ──────────────────────────────────────────────────────────────
 *
 * `ROUTES_AUTORISEES` ferme la porte au cas résiduel : un email d'inscription
 * ancien, encore dans une boîte, dont le lien porte un code valable. Sans ce
 * filtre, ce code rouvrirait le raccourci qu'on vient de supprimer — un compte
 * vérifié d'un clic, sans jamais saisir de code.
 */
const ROUTES_AUTORISEES = ['/reinitialiser-mot-de-passe']

function redirectionPrivee(url: string) {
  return NextResponse.redirect(url, { headers: {
    'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
    Expires: '0', Pragma: 'no-cache',
  } })
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  // NextURL normalise 127.0.0.1 en localhost : changer d’hôte perd les cookies
  // PKCE/session. Le site configuré garde la même origine après l’échange.
  const origin = process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
    : request.nextUrl.origin
  const code = searchParams.get('code')
  const demande = searchParams.get('next')

  // Seule la réinitialisation de mot de passe passe encore par ici. Tout autre
  // usage — dont un ancien lien de confirmation d'inscription — est renvoyé
  // vers la saisie du code, sans qu'aucune session ne soit ouverte.
  if (!demande || !ROUTES_AUTORISEES.includes(demande)) {
    return redirectionPrivee(`${origin}/verification`)
  }

  const suite = demande

  if (!code) {
    return redirectionPrivee(`${origin}/connexion?erreur=lien_invalide`)
  }

  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return redirectionPrivee(`${origin}/connexion?erreur=lien_expire`)
  }

  return redirectionPrivee(`${origin}${suite}`)
}
