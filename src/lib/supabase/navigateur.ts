'use client'

import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/types/database'

/**
 * Client Supabase côté navigateur.
 *
 * N'utilise que la clé publique (anon). Toute écriture sensible passe par une
 * Server Action — ce client sert surtout à l'upload de la signature et à la
 * réinitialisation de mot de passe.
 */
export function creerClientNavigateur() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
