import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { cheminProtege, cheminPublic } from '@/lib/roles'
import type { Database } from '@/lib/types/database'

/*
 * Les règles de chemin — ce qui est gardé, ce qui est public — vivent dans
 * `roles.ts`, avec un banc qui les exerce. Écrites ici, elles n'étaient
 * testables que par un navigateur : c'est exactement la raison pour laquelle
 * l'oubli de `/me/invitation` a survécu à deux étapes.
 */

/**
 * Écrans d'authentification : une session ouverte n'y a rien à faire.
 *
 * `/entrer` n'en fait PAS partie, et c'est essentiel : c'est la page de choix,
 * elle s'adresse justement à quelqu'un de connecté qui porte les deux rôles.
 * L'y refuser produirait une boucle entre elle et l'espace vers lequel on le
 * renverrait.
 */
const PAGES_AUTH = ['/connexion', '/inscription']

/**
 * Rafraîchit la session à chaque requête et garde les routes privées.
 *
 * Ce fichier s'appelle `proxy.ts` : c'est le nom retenu par Next.js 16 pour ce
 * qui s'appelait `middleware.ts`.
 */
export default async function proxy(request: NextRequest) {
  let reponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesAEcrire, enTetes) {
          for (const { name, value } of cookiesAEcrire) {
            request.cookies.set(name, value)
          }
          reponse = NextResponse.next({ request })
          for (const [nom, valeur] of Object.entries(enTetes)) reponse.headers.set(nom, valeur)
          for (const { name, value, options } of cookiesAEcrire) {
            reponse.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // Ne jamais insérer de logique entre createServerClient et getUser : c'est
  // cet appel qui renouvelle le token et réécrit les cookies de session.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Conserver les mutations Auth et ses en-têtes anti-cache sur chaque sortie.
  function rediriger(url: URL) {
    const sortie = NextResponse.redirect(url)
    for (const cookie of reponse.cookies.getAll()) sortie.cookies.set(cookie)
    for (const nom of ['Cache-Control', 'Expires', 'Pragma']) {
      const valeur = reponse.headers.get(nom)
      if (valeur !== null) sortie.headers.set(nom, valeur)
    }
    return sortie
  }

  const chemin = request.nextUrl.pathname

  const publique = cheminPublic(chemin)

  if (!user && !publique && cheminProtege(chemin)) {
    const url = request.nextUrl.clone()
    url.pathname = '/connexion'
    url.searchParams.set('suite', chemin)
    return rediriger(url)
  }

  if (user && PAGES_AUTH.includes(chemin)) {
    // Vers la page de choix, et non plus vers `/pro` : un locataire connecté
    // renvoyé vers l'espace du bailleur rebondirait aussitôt. `/entrer`
    // aiguille chacun vers le sien, ou pose la question à qui porte les deux.
    const url = request.nextUrl.clone()
    url.pathname = '/entrer'
    url.search = ''
    return rediriger(url)
  }

  return reponse
}

export const config = {
  matcher: [
    /*
     * Tout sauf les fichiers statiques et les images — inutile de réveiller
     * l'auth pour servir une icône.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
