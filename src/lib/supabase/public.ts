import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types/database'

/**
 * Client anonyme, sans session ni cookie — pour lire la vitrine publique hors
 * d'une requête d'utilisateur.
 *
 * Le plan du site n'a pas de visiteur : il n'y a aucun cookie à lire, et
 * `creerClientServeur` en réclame. Ce client porte la seule clé publique ; il
 * n'atteint que les fonctions ouvertes à `anon` — exactement ce qu'un visiteur
 * atteint lui-même.
 */
export function creerClientPublic() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
