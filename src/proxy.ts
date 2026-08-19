import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/types/database'

/** Préfixes réservés aux bailleurs authentifiés. */
const PREFIXES_PROTEGES = ['/app']

/** Écrans d'authentification : un bailleur déjà connecté n'y a rien à faire. */
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

  if (!user && PREFIXES_PROTEGES.some((p) => chemin.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/connexion'
    url.searchParams.set('suite', chemin)
    return NextResponse.redirect(url)
  }

  if (user && PAGES_AUTH.includes(chemin)) {
    const url = request.nextUrl.clone()
    url.pathname = '/app'
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
