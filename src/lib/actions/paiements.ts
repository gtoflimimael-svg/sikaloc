'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { debutDeMois } from '@/lib/format'
import { empreinte, genererEtStocker } from '@/lib/quittance'
import { bailleurAvecEcriture, bailleurCourant } from '@/lib/session'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { erreursChamps, schemaPaiement, type EtatFormulaire } from '@/lib/validation'
import { ESPACE_PRO } from '@/lib/roles'

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

// ─── Étape 1 — saisie (statut « Brouillon ») ────────────────────────────────

export async function enregistrerPaiement(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = lireFormulaire(donnees)
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()

  const { data: paiementId, error } = await supabase.rpc('creer_paiement_brouillon', {
    p_bail_id: analyse.data.bailId,
    p_date_paiement: analyse.data.datePaiement,
    p_montant: analyse.data.montant,
    p_periode_debut: debutDeMois(analyse.data.periodeDebut),
    p_mode_paiement: analyse.data.modePaiement,
    p_type_paiement: analyse.data.typePaiement,
  })

  if (error) return { erreur: `Enregistrement impossible : ${error.message}` }
  if (!paiementId) return { erreur: 'Enregistrement impossible. Réessayez.' }

  // Écran de récapitulatif avant validation (§6.1.7, étape 4).
  redirect(`/pro/paiements/${paiementId}/confirmer`)
}

// ─── Étape 2 — confirmation, validation et émission du document ─────────────

export async function validerPaiement(id: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  let quittance
  try {
    // Le générateur authentifie lui-même l'appelant; la RPC valide et autorise
    // avant tout effet PDF/Storage. Aucune opération lancée en parallèle.
    quittance = await genererEtStocker(id, true)
  } catch {
    return { erreur: 'Validation ou émission impossible. Le paiement peut déjà être validé : consultez sa fiche puis relancez la génération si nécessaire.' }
  }

  revalidatePath(ESPACE_PRO.tableauDeBord)
  revalidatePath('/pro/paiements')
  revalidatePath('/pro/impayes')

  redirect(`/pro/quittances/${quittance.id}`)
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
    const acces = await bailleurAvecEcriture()
    if (!acces.ok) return acces.etat
    const quittance = await genererEtStocker(paiementId)
    revalidatePath('/pro/paiements')
    redirect(`/pro/quittances/${quittance.id}`)
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

  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()
  const periodeDebut = debutDeMois(analyse.data.periodeDebut)

  const { data: corrige, error } = await supabase.rpc('corriger_paiement', {
    p_paiement_id: id,
    p_bail_id: analyse.data.bailId,
    p_date_paiement: analyse.data.datePaiement,
    p_montant: analyse.data.montant,
    p_periode_debut: periodeDebut,
    p_mode_paiement: analyse.data.modePaiement,
    p_type_paiement: analyse.data.typePaiement,
  })

  if (error) {
    // Le trigger `proteger_paiement_fige` remonte ici passé les 5 minutes.
    return { erreur: error.message.replace(/^.*?:\s*/, '') }
  }

  if (!corrige) return { erreur: 'Paiement impossible ou non autorisé.' }
  revalidatePath('/pro/paiements')
  redirect(`/pro/paiements/${id}/confirmer`)
}

export async function supprimerPaiement(id: string): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const supabase = await creerClientServeur()
  const { data: supprime, error } = await supabase.rpc('supprimer_paiement', {
    p_paiement_id: id,
  })

  if (error || !supprime) return { erreur: 'Paiement impossible ou non autorisé.' }

  revalidatePath('/pro/paiements')
  revalidatePath(ESPACE_PRO.tableauDeBord)
  redirect('/pro/paiements')
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
