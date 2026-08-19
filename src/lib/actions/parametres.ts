'use server'

import { revalidatePath } from 'next/cache'

import { bailleurCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import {
  erreursChamps,
  schemaNouveauMotDePasse,
  schemaPreferences,
  schemaProfil,
  type EtatFormulaire,
} from '@/lib/validation'

const TAILLE_MAX_SIGNATURE = 2 * 1024 * 1024
const TYPES_SIGNATURE = ['image/png', 'image/jpeg', 'image/webp']

export async function modifierProfil(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaProfil.safeParse({
    nom: donnees.get('nom'),
    telephone: donnees.get('telephone'),
    adresse: donnees.get('adresse') ?? '',
    avatar: donnees.get('avatar') ?? '',
  })

  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  const { error } = await supabase
    .from('bailleurs')
    .update({
      nom: analyse.data.nom,
      telephone: analyse.data.telephone,
      adresse: analyse.data.adresse || null,
      avatar: analyse.data.avatar || null,
    })
    .eq('id', bailleur.id)

  if (error) return { erreur: `Mise à jour impossible : ${error.message}` }

  revalidatePath('/app/parametres')
  return { succes: 'Profil mis à jour.' }
}

export async function modifierPreferences(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaPreferences.safeParse({
    notifEmail: donnees.get('notifEmail') === 'on',
    notifWhatsApp: donnees.get('notifWhatsApp') === 'on',
  })

  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  const { error } = await supabase
    .from('bailleurs')
    .update({
      notif_email: analyse.data.notifEmail,
      notif_whatsapp: analyse.data.notifWhatsApp,
    })
    .eq('id', bailleur.id)

  if (error) return { erreur: `Mise à jour impossible : ${error.message}` }

  revalidatePath('/app/parametres')
  return { succes: 'Préférences enregistrées.' }
}

/**
 * Téléversement de la signature — spec §6.1.10 : incrustée sur chaque PDF.
 *
 * Le fichier va dans un bucket privé, sous un préfixe égal à l'identifiant du
 * bailleur : c'est ce premier segment de chemin que la policy Storage vérifie.
 */
export async function televerserSignature(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const fichier = donnees.get('signature')

  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Sélectionnez une image de signature.' }
  }

  if (!TYPES_SIGNATURE.includes(fichier.type)) {
    return { erreur: 'Formats acceptés : PNG, JPEG ou WebP.' }
  }

  if (fichier.size > TAILLE_MAX_SIGNATURE) {
    return { erreur: 'L’image ne doit pas dépasser 2 Mo.' }
  }

  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  const extension = fichier.type === 'image/png' ? 'png' : fichier.type === 'image/webp' ? 'webp' : 'jpg'
  const chemin = `${bailleur.id}/signature.${extension}`

  const { error: erreurUpload } = await supabase.storage
    .from('signatures')
    .upload(chemin, fichier, { contentType: fichier.type, upsert: true })

  if (erreurUpload) return { erreur: `Téléversement impossible : ${erreurUpload.message}` }

  // Un changement d'extension laisserait l'ancien fichier derrière lui.
  if (bailleur.signature_chemin && bailleur.signature_chemin !== chemin) {
    await supabase.storage.from('signatures').remove([bailleur.signature_chemin])
  }

  const { error } = await supabase
    .from('bailleurs')
    .update({ signature_chemin: chemin })
    .eq('id', bailleur.id)

  if (error) return { erreur: `Enregistrement impossible : ${error.message}` }

  revalidatePath('/app/parametres')
  return { succes: 'Signature enregistrée. Elle apparaîtra sur vos prochaines quittances.' }
}

export async function supprimerSignature(): Promise<EtatFormulaire> {
  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  if (bailleur.signature_chemin) {
    await supabase.storage.from('signatures').remove([bailleur.signature_chemin])
  }

  const { error } = await supabase
    .from('bailleurs')
    .update({ signature_chemin: null })
    .eq('id', bailleur.id)

  if (error) return { erreur: `Suppression impossible : ${error.message}` }

  revalidatePath('/app/parametres')
  return { succes: 'Signature supprimée.' }
}

export async function changerMotDePasse(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaNouveauMotDePasse.safeParse({
    motDePasse: donnees.get('motDePasse'),
    confirmation: donnees.get('confirmation'),
  })

  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.updateUser({ password: analyse.data.motDePasse })

  if (error) return { erreur: `Changement impossible : ${error.message}` }

  return { succes: 'Mot de passe mis à jour.' }
}
