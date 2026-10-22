import 'server-only'

import type { User } from '@supabase/supabase-js'

import { obtenirUtilisateur } from '@/lib/supabase/serveur'

/** Liste explicite d'identifiants Auth, jamais de rôle fourni par le client. */
export function identifiantsAdminQuestions(): Set<string> {
  return new Set(
    (process.env.SIKALOC_QUESTIONS_ADMIN_IDS ?? '')
      .split(',')
      .map((identifiant) => identifiant.trim().toLowerCase())
      .filter((identifiant) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(identifiant)),
  )
}

export function estAdminQuestions(user: User | null): user is User {
  return Boolean(user && identifiantsAdminQuestions().has(user.id.toLowerCase()))
}

/** Les opérations d'écriture depuis le panneau interne exigent une origine navigateur de même origine. */
export function origineInterneValide(request: Request): boolean {
  const origine = request.headers.get('origin')
  if (!origine) return false

  try {
    return new URL(origine).origin === new URL(request.url).origin
  } catch {
    return false
  }
}
