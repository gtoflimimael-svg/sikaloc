'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { debutDeMois, finDeMois } from '@/lib/format'
import { empreinte, genererEtStocker } from '@/lib/quittance'
import { bailleurAvecEcriture, bailleurCourant } from '@/lib/session'
import { creerClientAdmin } from '@/lib/supabase/admin'
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
/**
 * Refabrique le document d'un paiement.
 *
 * Refusée dès que le document est signé et son paiement figé : la fabrication
 * lit la signature du profil, et un bailleur ayant changé de signature
 * obtiendrait, sous le même numéro, un document portant une autre main.
 *
 * Le garde qui compte est en base — déclencheurs `signatures_apposees_immuable_*`.
 * Ce qui suit ne fait que traduire leur refus en une phrase lisible.
 */
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

/**
 * Vérifie qu'un document n'a pas bougé depuis sa signature.
 *
 * On recalcule l'empreinte du fichier réellement archivé et on la compare à
 * celle enregistrée au moment de l'apposition. C'est tout — et c'est déjà ce
 * qui compte : le locataire détient une copie de ce fichier-là.
 *
 * Prudence délibérée sur les mots. Une empreinte qui diffère ne prouve pas une
 * falsification : le fichier a pu être redéposé, ou l'apposition manquer. On
 * dit donc ce qu'on constate — le contenu ne correspond plus — sans accuser
 * personne, comme le demande le cahier des charges.
 */
export async function verifierIntegrite(quittanceId: string): Promise<EtatFormulaire> {
  // Appelé pour la garde, pas pour sa valeur : il redirige vers la connexion
  // si aucune session n'est ouverte.
  await bailleurCourant()
  const supabase = await creerClientServeur()

  // Lecture par le client de session : la RLS interdit de viser le document
  // d'un autre bailleur.
  const { data: quittance } = await supabase
    .from('quittances')
    .select('pdf_chemin, hash_sha256')
    .eq('id', quittanceId)
    .maybeSingle()

  if (!quittance?.pdf_chemin) {
    return { erreur: 'Ce document n’a pas de fichier archivé : rien à vérifier.' }
  }

  const { data: apposition } = await supabase
    .from('signatures_apposees')
    .select('hash_document, retroactif')
    .eq('quittance_id', quittanceId)
    .maybeSingle()

  const reference = apposition?.hash_document ?? quittance.hash_sha256
  if (!reference) {
    return { erreur: 'Aucune empreinte n’a été enregistrée pour ce document.' }
  }

  const admin = creerClientAdmin()
  const { data: fichier } = await admin.storage
    .from('quittances')
    .download(quittance.pdf_chemin)

  if (!fichier) {
    return { erreur: 'Le fichier archivé est momentanément indisponible. Réessayez.' }
  }

  const actuelle = empreinte(Buffer.from(await fichier.arrayBuffer()))

  if (actuelle === reference) {
    return {
      succes:
        'Document intact. Il correspond exactement à la version enregistrée au moment de la signature.',
    }
  }

  return {
    erreur:
      'Le contenu actuel ne correspond plus à la version enregistrée lors de la signature. ' +
      'Conservez la copie remise à votre locataire et signalez-le nous.',
  }
}
