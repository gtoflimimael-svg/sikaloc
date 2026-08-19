import { NextResponse, type NextRequest } from 'next/server'

import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Point d'atterrissage des liens envoyés par email : confirmation d'inscription
 * et réinitialisation de mot de passe.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')

  // `next` vient de l'URL : on n'accepte qu'un chemin relatif, jamais une
  // adresse absolue qui transformerait ce point d'entrée en redirection ouverte.
  const demande = searchParams.get('next') ?? '/app'
  const suite = demande.startsWith('/') && !demande.startsWith('//') ? demande : '/app'

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?erreur=lien_invalide`)
  }

  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/connexion?erreur=lien_expire`)
  }

  return NextResponse.redirect(`${origin}${suite}`)
}
