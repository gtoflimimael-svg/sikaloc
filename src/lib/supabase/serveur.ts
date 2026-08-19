import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/lib/types/database'

/**
 * Client Supabase pour les Server Components, Server Actions et Route Handlers.
 *
 * La session vit dans des cookies httpOnly gérés par @supabase/ssr — c'est ce
 * que demande la spec §9.2 (« JWT sécurisé, httpOnly cookie »).
 */
export async function creerClientServeur() {
  const magasinCookies = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return magasinCookies.getAll()
        },
        setAll(cookiesAEcrire) {
          try {
            for (const { name, value, options } of cookiesAEcrire) {
              magasinCookies.set(name, value, options)
            }
          } catch {
            // Appel depuis un Server Component : l'écriture de cookies y est
            // interdite. Le middleware rafraîchit déjà la session, on ignore.
          }
        },
      },
    },
  )
}

/**
 * Retourne l'utilisateur authentifié, ou null.
 *
 * Toujours `getUser()` et jamais `getSession()` côté serveur : getUser valide
 * le JWT auprès du serveur d'auth, alors que getSession fait confiance au
 * contenu du cookie, qui est manipulable par le client.
 */
export async function obtenirUtilisateur() {
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}
