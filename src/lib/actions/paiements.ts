'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { debutDeMois, finDeMois } from '@/lib/format'
import { genererEtStocker } from '@/lib/quittance'
import { bailleurAvecEcriture } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { erreursChamps, schemaPaiement, type EtatFormulaire } from '@/lib/validation'

function lireFormulaire(donnees: FormData) {
  return schemaPaiement.safeParse({
    bailId: donnees.get('bailId'),
    montant: donnees.get('montant'),
    datePaiement: donnees.get('datePaiement'),
    periodeDebut: donnees.get('periodeDebut'),
    modePaiement: donnees.get('modePaiement'),
    typePaiement: donnees.get('typePaiement') || 'Loyer',
  })
}

/**
 * Détermine si la période reste incomplète après ce versement.
 *
 * On compare la somme des versements de la période — et non le seul montant
 * saisi : deux acomptes qui totalisent le loyer soldent le mois, et le document
 * émis doit alors être une quittance, pas un reçu.
 */
async function calculerEstPartiel(
  bailId: string,
  periodeDebut: string,
  montant: number,
  typePaiement: string,
  paiementExclu?: string,
): Promise<boolean> {
  if (typePaiement !== 'Loyer') return false

  const supabase = await creerClientServeur()

  const { data: bail } = await supabase
    .from('baux')
    .select('loyer_mensuel')
    .eq('id', bailId)
    .single()

  if (!bail) return false

  let requete = supabase
    .from('paiements')
    .select('montant')
    .eq('bail_id', bailId)
    .eq('periode_debut', periodeDebut)
    .eq('type_paiement', 'Loyer')
    .eq('statut', 'Validé')

  if (paiementExclu) requete = requete.neq('id', paiementExclu)

  const { data: autres } = await requete

  const dejaPaye = (autres ?? []).reduce((somme, p) => somme + Number(p.montant), 0)

  return dejaPaye + montant < Number(bail.loyer_mensuel)
}

// ─── Étape 1 — saisie (statut « Brouillon ») ────────────────────────────────

export async function enregistrerPaiement(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const bailleur = acces.bailleur
  const supabase = await creerClientServeur()

  const periodeDebut = debutDeMois(analyse.data.periodeDebut)
  const periodeFin = finDeMois(periodeDebut)

  const estPartiel = await calculerEstPartiel(
    analyse.data.bailId,
    periodeDebut,
    analyse.data.montant,
    analyse.data.typePaiement,
  )

  const { data, error } = await supabase
    .from('paiements')
    .insert({
      bailleur_id: bailleur.id,
      bail_id: analyse.data.bailId,
      date_paiement: analyse.data.datePaiement,
      montant: analyse.data.montant,
      periode_debut: periodeDebut,
      periode_fin: periodeFin,
      mode_paiement: analyse.data.modePaiement,
      type_paiement: analyse.data.typePaiement,
      est_partiel: estPartiel,
      statut: 'Brouillon',
    })
    .select('id')
    .single()

  if (error) return { erreur: `Enregistrement impossible : ${error.message}` }

  // Écran de récapitulatif avant validation (§6.1.7, étape 4).
  redirect(`/app/paiements/${data.id}/confirmer`)
}

// ─── Étape 2 — confirmation, validation et émission du document ─────────────

export async function validerPaiement(id: string): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()

  // `genererEtStocker` relit le paiement par id et n'utilise jamais son
  // `statut` pour composer le document (voir `DonneesQuittance`) : rien
  // n'oblige donc à attendre que l'écriture du statut soit passée avant de
  // lancer la génération. C'est le point de la confirmation de paiement où la
  // latence se sent le plus — les deux partent en parallèle plutôt que bout à
  // bout.
  const [ecriture, quittance] = await Promise.allSettled([
    supabase
      .from('paiements')
      .update({ statut: 'Validé', valide_le: new Date().toISOString() })
      .eq('id', id),
    genererEtStocker(id),
  ])

  if (ecriture.status === 'rejected' || ecriture.value.error) {
    const message =
      ecriture.status === 'rejected'
        ? String(ecriture.reason)
        : ecriture.value.error?.message
    return { erreur: `Validation impossible : ${message}` }
  }

  if (quittance.status === 'rejected') {
    // Le paiement reste validé : c'est un fait comptable. Seul le document a
    // échoué, et il est régénérable depuis la fiche du paiement.
    const erreur = quittance.reason
    return {
      erreur:
        erreur instanceof Error
          ? `Paiement validé, mais le document n'a pas pu être produit : ${erreur.message}`
          : 'Paiement validé, mais le document n’a pas pu être produit.',
    }
  }

  revalidatePath('/app')
  revalidatePath('/app/paiements')
  revalidatePath('/app/impayes')

  redirect(`/app/quittances/${quittance.value.id}`)
}

/** Régénère le document d'un paiement déjà validé. */
export async function regenererQuittance(paiementId: string): Promise<EtatFormulaire> {
  try {
    const quittance = await genererEtStocker(paiementId)
    revalidatePath('/app/paiements')
    redirect(`/app/quittances/${quittance.id}`)
  } catch (erreur) {
    if (erreur instanceof Error && erreur.message === 'NEXT_REDIRECT') throw erreur
    return {
      erreur:
        erreur instanceof Error
          ? `Génération impossible : ${erreur.message}`
          : 'Génération impossible.',
    }
  }
}

// ─── Correction dans la fenêtre de 5 minutes ────────────────────────────────

export async function corrigerPaiement(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const supabase = await creerClientServeur()
  const periodeDebut = debutDeMois(analyse.data.periodeDebut)

  const estPartiel = await calculerEstPartiel(
    analyse.data.bailId,
    periodeDebut,
    analyse.data.montant,
    analyse.data.typePaiement,
    id,
  )

  const { error } = await supabase
    .from('paiements')
    .update({
      bail_id: analyse.data.bailId,
      date_paiement: analyse.data.datePaiement,
      montant: analyse.data.montant,
      periode_debut: periodeDebut,
      periode_fin: finDeMois(periodeDebut),
      mode_paiement: analyse.data.modePaiement,
      type_paiement: analyse.data.typePaiement,
      est_partiel: estPartiel,
      // Retour en brouillon : la correction annule la validation précédente,
      // le bailleur doit reconfirmer pour réémettre le document.
      statut: 'Brouillon',
      valide_le: null,
    })
    .eq('id', id)

  if (error) {
    // Le trigger `proteger_paiement_fige` remonte ici passé les 5 minutes.
    return { erreur: error.message.replace(/^.*?:\s*/, '') }
  }

  revalidatePath('/app/paiements')
  redirect(`/app/paiements/${id}/confirmer`)
}

export async function supprimerPaiement(id: string): Promise<EtatFormulaire> {
  const supabase = await creerClientServeur()
  const { error } = await supabase.from('paiements').delete().eq('id', id)

  if (error) return { erreur: error.message.replace(/^.*?:\s*/, '') }

  revalidatePath('/app/paiements')
  revalidatePath('/app')
  redirect('/app/paiements')
}
