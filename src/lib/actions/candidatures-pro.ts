'use server'

import { revalidatePath } from 'next/cache'

import { messageCandidature } from '@/lib/candidatures/messages'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { StatutCandidature } from '@/lib/types/database'
import type { EtatFormulaire } from '@/lib/validation'

/**
 * Répondre à une candidature — le seul geste du bailleur en S8-C.
 *
 * ─── Ce que cette action ne décide pas ─────────────────────────────────────
 *
 * Ni qui répond, ni sur quoi. `repondre_candidature` (S8-A) n'agit que sur une
 * candidature dont l'annonce appartient à la session ; une candidature d'un
 * autre bailleur ne remonte pas une erreur de permission, elle est simplement
 * introuvable. Et le déclencheur `verifier_transition_candidature` tranche la
 * transition elle-même : « acceptée » est terminale, « retirée » appartient au
 * candidat.
 *
 * L'identifiant vient donc du navigateur sans que cela pose problème — il ne
 * donne aucun pouvoir par lui-même. Ce qui vaut autorisation, c'est la session,
 * et elle n'est pas dans le formulaire.
 *
 * ─── Pourquoi l'écran ne suffit pas ────────────────────────────────────────
 *
 * Les boutons proposés dépendent du statut affiché, qui datait du chargement de
 * la page. Entre l'affichage et le clic, le candidat a pu retirer sa
 * candidature. La base refuse alors, et le bailleur lit pourquoi — plutôt que
 * de voir un bouton réussir sur un état qui n'existe plus.
 */
export async function repondreCandidature(
  candidatureId: string,
  statut: Extract<StatutCandidature, 'en_etude' | 'acceptee' | 'refusee'>,
): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const supabase = await creerClientServeur()
  const { data, error } = await supabase.rpc('repondre_candidature', {
    p_candidature_id: candidatureId,
    p_statut: statut,
  })

  if (error) {
    // Journalisée, jamais montrée : un code SQL n'apprend rien au bailleur.
    console.error('[candidatures-pro] réponse', error.code, error.message)
    return { erreur: messageCandidature('echec_reponse') }
  }

  const motif = data?.[0]?.motif
  if (motif !== 'ok') return { erreur: messageCandidature(motif) }

  revalidatePath('/pro/annonces', 'layout')
  return { succes: SUCCES[statut] }
}

const SUCCES: Record<'en_etude' | 'acceptee' | 'refusee', string> = {
  en_etude: 'Candidature mise à l’étude.',
  acceptee: 'Candidature acceptée.',
  refusee: 'Candidature refusée.',
}
