import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/types/database'

/** Préfixes réservés aux comptes authentifiés — les deux espaces. */
const PREFIXES_PROTEGES = ['/app', '/me']

/**
 * Les exceptions publiques à l'intérieur d'un espace protégé.
 *
 * `/me/rejoindre` explique comment obtenir un accès locataire : elle s'adresse
 * précisément à quelqu'un qui n'a pas encore de compte. La protéger la rendait
 * inatteignable pour son seul public, et renvoyait vers une connexion
 * impossible — le locataire n'a pas d'identifiants à ce stade.
 */
const EXCEPTIONS_PUBLIQUES = ['/me/rejoindre']

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
        setAll(cookiesAEcrire) {
          for (const { name, value } of cookiesAEcrire) {
            request.cookies.set(name, value)
          }
          reponse = NextResponse.next({ request })
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

  const chemin = request.nextUrl.pathname

  const publique = EXCEPTIONS_PUBLIQUES.some(
    (p) => chemin === p || chemin.startsWith(`${p}/`),
  )

  if (!user && !publique && PREFIXES_PROTEGES.some((p) => chemin.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/connexion'
    url.searchParams.set('suite', chemin)
    return NextResponse.redirect(url)
  }

  if (user && PAGES_AUTH.includes(chemin)) {
    // Vers la page de choix, et non plus vers `/app` : un locataire connecté
    // renvoyé vers l'espace du bailleur rebondirait aussitôt. `/entrer`
    // aiguille chacun vers le sien, ou pose la question à qui porte les deux.
    const url = request.nextUrl.clone()
    url.pathname = '/entrer'
    url.search = ''
    return NextResponse.redirect(url)
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
