import 'server-only'

import type { StatutTransaction } from '@/lib/fedapay'
import { creerClientAdmin } from '@/lib/supabase/admin'

/** La seule écriture commerciale est une finalisation SQL atomique.
 * La preuve vient exclusivement de verifierTransaction (API secrète FedaPay).
 * Aucun crédit arbitraire par identifiant de bailleur ni nombre de mois libre.
 */
export async function finaliserAbonnement(preuve: StatutTransaction): Promise<string> {
  const { data, error } = await creerClientAdmin().rpc('finaliser_abonnement_fedapay', {
    p_transaction_id: preuve.transactionId, p_reference: preuve.reference,
    p_bailleur: preuve.bailleurId, p_montant: preuve.montant, p_devise: preuve.devise,
    p_statut: preuve.statut, p_formule: preuve.formule, p_environnement: preuve.environnement,
  })
  if (error || typeof data !== 'string') throw new Error('Finalisation indisponible.')
  return data
}
