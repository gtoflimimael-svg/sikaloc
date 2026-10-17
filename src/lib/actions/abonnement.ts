'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { DESCRIPTION_ABONNEMENT, DEVISE, FORMULE_ABONNEMENT, MONTANT_ABONNEMENT, initierPaiement } from '@/lib/fedapay'
import { bailleurCourant } from '@/lib/session'
import { creerClientAdmin } from '@/lib/supabase/admin'
import type { EtatFormulaire } from '@/lib/validation'

async function urlDeBase(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL

  const enTetes = await headers()
  const hote = enTetes.get('host') ?? 'localhost:3000'
  const protocole = hote.startsWith('localhost') || hote.startsWith('127.') ? 'http' : 'https'

  return `${protocole}://${hote}`
}

/**
 * Souscription au plan Standard — 5 000 FCFA/mois par Mobile Money (FedaPay).
 *
 * L'ordre compte : FedaPay crée la transaction et nous rend son identifiant,
 * que l'on enregistre AVANT de rediriger vers le guichet. Si la notification
 * arrive pendant que le bailleur est encore en train de payer, elle retrouve à
 * quel compte rattacher le règlement.
 */
export async function souscrire(_etat: EtatFormulaire): Promise<EtatFormulaire> {
  const bailleur = await bailleurCourant()
  const base = await urlDeBase()

  const resultat = await initierPaiement({
    montant: MONTANT_ABONNEMENT,
    description: DESCRIPTION_ABONNEMENT,
    urlRetour: `${base}/pro/parametres/abonnement?retour=1`,
    clientNom: bailleur.nom,
    clientEmail: bailleur.email,
    clientTelephone: bailleur.telephone,
    bailleurId: bailleur.id,
  }, async (transaction) => {
    const { error } = await creerClientAdmin().from('abonnements_transactions').insert({
      bailleur_id: bailleur.id, transaction_id: transaction.id,
      reference_fedapay: transaction.reference, environnement_fedapay: transaction.environnement,
      montant: MONTANT_ABONNEMENT, devise: DEVISE, formule: FORMULE_ABONNEMENT, contrat_fedapay: 'standard_v1', statut: 'EN_ATTENTE',
    })
    if (error) throw new Error('Enregistrement de transaction impossible.')
  })

  if (!resultat.ok || !resultat.urlPaiement || !resultat.transactionId) {
    return { erreur: resultat.message ?? 'Le guichet de paiement est indisponible.' }
  }

  redirect(resultat.urlPaiement)
}
