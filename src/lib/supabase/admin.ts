import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/types/database'

/**
 * Client à privilèges élevés (service_role) — contourne toutes les RLS.
 *
 * Réservé à quatre usages serveur qui ne peuvent pas s'exécuter dans le contexte
 * d'un utilisateur :
 *   - écrire la quittance générée dans le bucket privé,
 *   - traiter la notification de paiement FedaPay (aucune session),
 *   - compter les tentatives de connexion (avant authentification),
 *   - écrire et retirer les photos d'annonce dans le bucket `annonces`, qui
 *     n'a aucune politique — APRÈS que la session du bailleur a établi son
 *     droit (voir `lib/annonces/depot-photos.ts`).
 *
 * L'import de `server-only` fait échouer la compilation si ce fichier venait à
 * être tiré dans un bundle client.
 */
export function creerClientAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !cle) {
    throw new Error(
      'Configuration manquante : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY ' +
        'sont requis pour les opérations serveur (génération de quittance, webhooks).',
    )
  }

  return createClient<Database>(url, cle, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
