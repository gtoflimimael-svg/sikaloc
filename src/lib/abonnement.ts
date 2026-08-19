import 'server-only'

import { creerClientAdmin } from '@/lib/supabase/admin'

/**
 * Crédit d'abonnement et récompenses de parrainage.
 *
 * Appelé depuis la notification FedaPay, hors de toute session : d'où
 * l'utilisation du client admin.
 */

/** Ajoute des mois à une date de fin, en repartant d'aujourd'hui si expirée. */
function prolonger(dateFin: string | null, mois: number): string {
  const aujourdhui = new Date()
  const depart =
    dateFin && dateFin >= aujourdhui.toISOString().slice(0, 10)
      ? new Date(`${dateFin}T00:00:00Z`)
      : aujourdhui

  const nouvelle = new Date(depart)
  nouvelle.setMonth(nouvelle.getMonth() + mois)

  return nouvelle.toISOString().slice(0, 10)
}

/**
 * Passe le bailleur en Standard et prolonge son abonnement d'un mois.
 *
 * Déclenche également la récompense de parrainage (§4.5) : à la première
 * souscription payante d'un filleul, le parrain et le filleul reçoivent chacun
 * un mois offert. La contrainte UNIQUE (parrain_id, filleul_id) garantit qu'un
 * renouvellement ne re-déclenche pas la récompense.
 */
export async function crediterAbonnement(bailleurId: string, mois = 1): Promise<void> {
  const admin = creerClientAdmin()

  const { data: bailleur } = await admin
    .from('bailleurs')
    .select('id, plan, date_fin_abonnement, parrain_id')
    .eq('id', bailleurId)
    .single()

  if (!bailleur) return

  const premiereSouscription = bailleur.plan !== 'Standard' || !bailleur.date_fin_abonnement
  let moisTotal = mois

  // Le filleul reçoit son mois offert en même temps que son premier mois payé.
  if (premiereSouscription && bailleur.parrain_id) moisTotal += 1

  await admin
    .from('bailleurs')
    .update({
      plan: 'Standard',
      date_fin_abonnement: prolonger(bailleur.date_fin_abonnement, moisTotal),
    })
    .eq('id', bailleurId)

  // Un paiement abouti clôt le cycle de grâce. L'équivalent SQL vit dans
  // `prive.reactiver_abonnement`, mais ce schéma n'est pas exposé au Data API :
  // on écrit directement, avec la même sémantique.
  await admin
    .from('bailleurs')
    .update({
      statut_abonnement: 'actif',
      date_echec_paiement: null,
      dernier_rappel_envoye: null,
    })
    .eq('id', bailleurId)

  // Les rappels du cycle écoulé sont retirés pour qu'un futur impayé puisse en
  // réémettre — l'index unique (bailleur_id, modele) les bloquerait sinon.
  await admin
    .from('emails_a_envoyer')
    .delete()
    .eq('bailleur_id', bailleurId)
    .in('modele', ['grace_j0', 'grace_j3', 'grace_j30', 'purge_j90'])

  if (!premiereSouscription || !bailleur.parrain_id) return

  const { error } = await admin.from('recompenses_parrainage').insert({
    parrain_id: bailleur.parrain_id,
    filleul_id: bailleurId,
    mois_offerts: 1,
  })

  // Doublon : la récompense a déjà été versée, rien à faire.
  if (error) return

  const { data: parrain } = await admin
    .from('bailleurs')
    .select('date_fin_abonnement')
    .eq('id', bailleur.parrain_id)
    .single()

  if (!parrain) return

  await admin
    .from('bailleurs')
    .update({
      plan: 'Standard',
      date_fin_abonnement: prolonger(parrain.date_fin_abonnement, 1),
    })
    .eq('id', bailleur.parrain_id)
}

/**
 * Marque un échec de prélèvement — point d'entrée du cycle de grâce (J+0).
 *
 * On n'écrit que la date d'échec ; c'est la tâche planifiée
 * `prive.appliquer_cycle_grace()` qui fera progresser le statut et déposera le
 * rappel dans la file. Cette séparation garantit qu'un même échec, notifié
 * plusieurs fois par l'opérateur, ne produit qu'une seule séquence de rappels.
 */
export async function signalerEchecPaiement(bailleurId: string): Promise<void> {
  const admin = creerClientAdmin()

  const { data: bailleur } = await admin
    .from('bailleurs')
    .select('date_echec_paiement, statut_abonnement')
    .eq('id', bailleurId)
    .single()

  // Un cycle est déjà en cours : on ne redémarre pas le compte à rebours, sans
  // quoi un compte en impayé depuis 80 jours repartirait à zéro à chaque
  // tentative de prélèvement échouée.
  if (!bailleur || bailleur.date_echec_paiement) return

  await admin
    .from('bailleurs')
    .update({
      date_echec_paiement: new Date().toISOString(),
      statut_abonnement: 'grace',
    })
    .eq('id', bailleurId)
}
