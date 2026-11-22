import 'server-only'

import type { creerClientServeur } from '@/lib/supabase/serveur'
import type { TypePaiement } from '@/lib/types/database'

type ClientServeur = Awaited<ReturnType<typeof creerClientServeur>>

export type BaseApercuPaiement = {
  /** Montant exigible de la période, ou null s'il n'est pas établi. */
  loyerApplicable: number | null
  /** Loyers déjà validés pour la période, hors ce paiement ; null si inconnu. */
  cumulValideAvant: number | null
  /** false quand aucune source n'a pu renseigner l'aperçu. */
  disponible: boolean
  /** true quand la lecture a échoué (à distinguer d'une donnée absente). */
  erreur: boolean
}

/**
 * Données de l'aperçu du document avant validation d'un paiement.
 *
 * Source principale : `apercu_echeance_paiement`, qui calcule comme la RPC
 * d'émission, y compris pour un loyer payé d'avance (FN-05). Repli sur
 * `v_echeances` si la fonction n'est pas encore déployée : la vue ne couvre
 * que les périodes jusqu'au mois courant, l'aperçu reste alors prudent.
 * Rien n'est recalculé ici : la décision d'autorité reste en base.
 */
export async function lireBaseApercuPaiement(
  client: ClientServeur,
  paiement: {
    id: string
    bail_id: string
    periode_debut: string
    type_paiement: TypePaiement
    statut: string
    montant: number | string
  },
): Promise<BaseApercuPaiement> {
  if (paiement.type_paiement !== 'Loyer') {
    return { loyerApplicable: null, cumulValideAvant: null, disponible: true, erreur: false }
  }

  const { data: calcul, error: erreurCalcul } = await client.rpc('apercu_echeance_paiement', {
    p_paiement_id: paiement.id,
  })
  const ligne = Array.isArray(calcul) ? calcul[0] : null
  if (!erreurCalcul && ligne) {
    return {
      loyerApplicable: ligne.montant_exigible === null ? null : Number(ligne.montant_exigible),
      cumulValideAvant: ligne.cumul_valide_avant === null ? null : Number(ligne.cumul_valide_avant),
      disponible: true,
      erreur: false,
    }
  }

  const { data: echeance, error: erreurEcheance } = await client
    .from('v_echeances')
    .select('montant_exigible, montant_paye')
    .eq('bail_id', paiement.bail_id)
    .eq('periode_debut', paiement.periode_debut)
    .maybeSingle()

  if (erreurEcheance) {
    return { loyerApplicable: null, cumulValideAvant: null, disponible: false, erreur: true }
  }

  const loyerApplicable = typeof echeance?.montant_exigible === 'number'
    ? Number(echeance.montant_exigible)
    : null
  const montantPaye = echeance ? Number(echeance.montant_paye) : null
  // La vue inclut ce paiement s'il est déjà validé mais que l'émission doit
  // être reprise : ne pas compter son montant deux fois dans l'aperçu.
  const cumulValideAvant = montantPaye === null
    ? null
    : montantPaye - (paiement.statut === 'Validé' ? Number(paiement.montant) : 0)

  return { loyerApplicable, cumulValideAvant, disponible: Boolean(echeance), erreur: false }
}
