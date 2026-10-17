import 'server-only'

import { finaliserAbonnement } from '@/lib/abonnement'
import { identifiantTransactionValide, verifierTransaction } from '@/lib/fedapay'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'

/**
 * Règlement d'une transaction d'abonnement FedaPay.
 *
 * Deux chemins mènent ici, et c'est délibéré :
 *
 *   1. `/api/abonnement/fedapay` — la notification de l'opérateur ;
 *   2. le retour du bailleur sur `/pro/parametres?retour=1`.
 *
 * Le premier peut ne jamais arriver : notification perdue, endpoint
 * momentanément en erreur, webhook désactivé. Le second dépend d'un bailleur
 * qui revient sur l'application. Aucun n'est fiable seul ; ensemble ils le
 * sont.
 *
 * D'où le point unique de passage : deux implémentations parallèles de la même
 * règle finiraient par diverger, et c'est de l'argent réel.
 */

export type EtatReglement =
  /** Le paiement vient d'être porté au crédit du bailleur. */
  | 'credite'
  /** Une autre exécution a crédité avant nous. Rien à faire, et surtout pas deux fois. */
  | 'deja_regle'
  /** L'opérateur n'a pas encore tranché. */
  | 'en_attente'
  /** Refusé, annulé ou échoué. */
  | 'echec'
  /** Transaction sans bailleur rattachable — on ne devine pas. */
  | 'inconnu'
  /** FedaPay injoignable : ne rien conclure, réessayer plus tard. */
  | 'indisponible'
  /** Historique REGLEE sans journal de crédit : pas de recrédit aveugle. */
  | 'a_reconcilier'

/**
 * Confronte une transaction à ce que FedaPay en dit, puis en tire les
 * conséquences.
 *
 * C'est l'API FedaPay qui fait foi — jamais le corps d'une requête entrante,
 * ni ce que la base croit savoir.
 */
export async function reglerTransaction(transactionId: string): Promise<EtatReglement> {
  if (!identifiantTransactionValide(transactionId)) return 'inconnu'
  try {
    const statut = await verifierTransaction(transactionId)
    if (!statut) return 'indisponible'
    const admin = creerClientAdmin()
    const { data: ligne, error } = await admin.from('abonnements_transactions')
      .select('bailleur_id, montant, devise, formule, contrat_fedapay, reference_fedapay, environnement_fedapay')
      .eq('transaction_id', transactionId).maybeSingle()
    if (error) return 'indisponible'
    // Pas de création à partir des seules métadonnées d'un paiement étranger.
    if (!ligne || ligne.bailleur_id !== statut.bailleurId || Number(ligne.montant) !== statut.montant ||
        ligne.devise !== statut.devise || ligne.formule !== statut.formule ||
        (ligne.reference_fedapay !== null && ligne.reference_fedapay !== statut.reference) ||
        (ligne.environnement_fedapay !== null && ligne.environnement_fedapay !== statut.environnement) ||
        (statut.contratHistorique && ligne.contrat_fedapay !== 'historique')) return 'inconnu'
    const resultat = await finaliserAbonnement(statut)
    return ['credite', 'deja_regle', 'en_attente', 'echec', 'inconnu', 'a_reconcilier'].includes(resultat)
      ? resultat as EtatReglement : 'indisponible'
  } catch {
    return 'indisponible'
  }
}

/**
 * Réconciliation au retour du guichet.
 *
 * On regarde la transaction la plus récente, y compris REGLEE pour détecter
 * un ancien crédit ambigu : le bailleur
 * revient de son paiement, c'est celle-là qui l'intéresse. Les plus anciennes
 * restées en attente relèvent du webhook ou d'un abandon, pas de cet écran.
 *
 * Ne lève jamais : cette fonction est appelée pendant le rendu d'une page, et
 * un abonnement non réconcilié vaut mieux qu'un écran d'erreur.
 */
export async function reconcilierRetourGuichet(
  bailleurId: string,
): Promise<EtatReglement> {
  try {
    const client = await creerClientServeur()
    const { data: { user }, error: erreurSession } = await client.auth.getUser()
    if (erreurSession || !user || user.id !== bailleurId) return 'inconnu'
    const admin = creerClientAdmin()

    const { data: enCours, error: erreurLecture } = await admin
      .from('abonnements_transactions')
      .select('transaction_id')
      .eq('bailleur_id', bailleurId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (erreurLecture) return 'indisponible'

    // Rien en attente : le webhook est passé avant nous, ou il n'y a jamais eu
    // de paiement à réconcilier.
    if (!enCours) return 'deja_regle'

    return await reglerTransaction(enCours.transaction_id)
  } catch {
    return 'indisponible'
  }
}
