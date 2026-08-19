import 'server-only'

import { crediterAbonnement, signalerEchecPaiement } from '@/lib/abonnement'
import { verifierTransaction } from '@/lib/fedapay'
import { creerClientAdmin } from '@/lib/supabase/admin'

/**
 * Règlement d'une transaction d'abonnement FedaPay.
 *
 * Deux chemins mènent ici, et c'est délibéré :
 *
 *   1. `/api/abonnement/fedapay` — la notification de l'opérateur ;
 *   2. le retour du bailleur sur `/app/parametres?retour=1`.
 *
 * Le premier peut ne jamais arriver : notification perdue, endpoint
 * momentanément en erreur, webhook désactivé. Le second dépend d'un bailleur
 * qui revient sur l'application. Aucun n'est fiable seul ; ensemble ils le
 * sont.
 *
 * D'où le point unique de passage : deux implémentations parallèles de la même
 * règle finiraient par diverger, et c'est de l'argent réel.
 */

/** Statuts FedaPay qui valent échec avéré — ils ouvrent le cycle de grâce. */
const STATUTS_ECHEC = ['declined', 'canceled', 'failed']

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

/**
 * Confronte une transaction à ce que FedaPay en dit, puis en tire les
 * conséquences.
 *
 * C'est l'API FedaPay qui fait foi — jamais le corps d'une requête entrante,
 * ni ce que la base croit savoir.
 */
export async function reglerTransaction(transactionId: string): Promise<EtatReglement> {
  const statut = await verifierTransaction(transactionId)

  // Vérification impossible : on ne crédite rien et on ne marque rien.
  if (!statut) return 'indisponible'

  const admin = creerClientAdmin()

  const { data: ligne } = await admin
    .from('abonnements_transactions')
    .select('id, bailleur_id, statut')
    .eq('transaction_id', transactionId)
    .maybeSingle()

  // Repli : si la transaction n'a pas été enregistrée à l'initiation, les
  // métadonnées FedaPay portent l'identifiant du bailleur.
  const bailleurId = ligne?.bailleur_id ?? statut.bailleurId
  if (!bailleurId) return 'inconnu'

  if (statut.reglee) {
    // ─── Arbitrage ────────────────────────────────────────────────────────
    // Lire le statut puis décider de créditer laisserait une fenêtre entre les
    // deux : le webhook et la réconciliation, lancés à quelques millisecondes
    // d'écart, liraient tous deux « EN_ATTENTE » et offriraient chacun un mois.
    //
    // La condition est donc portée par la base, dans l'instruction d'écriture
    // elle-même. Une seule exécution voit la ligne basculer ; elle seule
    // crédite.
    if (ligne) {
      const { data: bascule } = await admin
        .from('abonnements_transactions')
        .update({ statut: 'REGLEE', payload_notif: statut.brut as never })
        .eq('id', ligne.id)
        .neq('statut', 'REGLEE')
        .select('id')

      if (!bascule || bascule.length === 0) return 'deja_regle'
    } else {
      // Pas de ligne à faire basculer : c'est l'insertion qui arbitre, sur la
      // contrainte UNIQUE de `transaction_id`. Le perdant échoue, et n'a donc
      // pas le droit de créditer non plus.
      const { error } = await admin.from('abonnements_transactions').insert({
        bailleur_id: bailleurId,
        transaction_id: transactionId,
        montant: statut.montant,
        statut: 'REGLEE',
        payload_notif: statut.brut as never,
      })

      if (error) return 'deja_regle'
    }

    await crediterAbonnement(bailleurId)
    return 'credite'
  }

  // Pas encore réglée : on consigne l'état sans jamais écraser un « REGLEE »
  // qu'une exécution concurrente viendrait d'écrire.
  if (ligne) {
    await admin
      .from('abonnements_transactions')
      .update({
        statut: statut.statut.toUpperCase(),
        payload_notif: statut.brut as never,
      })
      .eq('id', ligne.id)
      .neq('statut', 'REGLEE')
  }

  if (STATUTS_ECHEC.includes(statut.statut)) {
    // `signalerEchecPaiement` ne redémarre pas un cycle déjà ouvert : un même
    // échec notifié plusieurs fois ne produit qu'une séquence de rappels.
    await signalerEchecPaiement(bailleurId)
    return 'echec'
  }

  return 'en_attente'
}

/**
 * Réconciliation au retour du guichet.
 *
 * On ne regarde que la transaction en cours la plus récente : le bailleur
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
    const admin = creerClientAdmin()

    const { data: enCours } = await admin
      .from('abonnements_transactions')
      .select('transaction_id')
      .eq('bailleur_id', bailleurId)
      .neq('statut', 'REGLEE')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Rien en attente : le webhook est passé avant nous, ou il n'y a jamais eu
    // de paiement à réconcilier.
    if (!enCours) return 'deja_regle'

    return await reglerTransaction(enCours.transaction_id)
  } catch {
    return 'indisponible'
  }
}
