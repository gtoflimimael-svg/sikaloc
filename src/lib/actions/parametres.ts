'use server'

import { revalidatePath } from 'next/cache'

import { bailleurCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { DESCRIPTION_FORMAT, reconnaitreFormat } from '@/lib/signature/fichier'
import { enregistrerTentative, verifierBlocage } from '@/lib/rate-limit'
import {
  avatarOptionnel,
  erreursChamps,
  refusMotDePasseContextuel,
  schemaChangementMotDePasse,
  schemaPreferences,
  schemaProfil,
  type EtatFormulaire,
} from '@/lib/validation'

const TAILLE_MAX_SIGNATURE = 2 * 1024 * 1024

export async function modifierProfil(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaProfil.safeParse({
    nom: donnees.get('nom'),
    telephone: donnees.get('telephone'),
    adresse: donnees.get('adresse') ?? '',
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
    })
    .eq('id', bailleur.id)

  if (error) return { erreur: `Mise à jour impossible : ${error.message}` }

  // Le nom du bailleur apparaît dans le shell et sur les quittances : c'est
  // tout l'espace applicatif qu'il faut réinvalider, pas seulement cet écran.
  revalidatePath('/app', 'layout')
  return { succes: 'Informations mises à jour.' }
}

/** Avatar seul — bloc distinct des informations personnelles. */
export async function modifierAvatar(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = avatarOptionnel.safeParse(donnees.get('avatar') ?? '')

  if (!analyse.success) {
    return { erreur: 'Cet avatar n’est pas valide. Recomposez-le puis réessayez.' }
  }

  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  const { error } = await supabase
    .from('bailleurs')
    .update({ avatar: analyse.data || null })
    .eq('id', bailleur.id)

  if (error) return { erreur: `Mise à jour impossible : ${error.message}` }

  revalidatePath('/app', 'layout')
  return { succes: 'Avatar mis à jour.' }
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

  if (fichier.size > TAILLE_MAX_SIGNATURE) {
    return { erreur: 'L’image ne doit pas dépasser 2 Mo.' }
  }

  // Le format est jugé sur les octets de tête, jamais sur `fichier.type` : ce
  // champ n'est qu'une chaîne envoyée par le client, au même titre que le nom du
  // fichier. C'est aussi lui qui décidera de l'extension et du `contentType`
  // enregistrés, pour qu'aucune valeur d'origine cliente ne subsiste.
  const format = await reconnaitreFormat(fichier)

  if (!format) {
    return { erreur: 'Formats acceptés : PNG, JPEG ou WebP.' }
  }

  const { type: typeReel, extension } = DESCRIPTION_FORMAT[format]

  const bailleur = await bailleurCourant()
  const supabase = await creerClientServeur()

  const chemin = `${bailleur.id}/signature.${extension}`

  const { error: erreurUpload } = await supabase.storage
    .from('signatures')
    .upload(chemin, fichier, { contentType: typeReel, upsert: true })

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

/**
 * Changement de mot de passe depuis les paramètres.
 *
 * Le mot de passe actuel est revérifié auprès de GoTrue avant d'accepter le
 * nouveau. C'est ce qui distingue « changer son mot de passe » de « prendre le
 * compte » : sans cette étape, une session laissée ouverte sur un poste
 * partagé suffisait à verrouiller définitivement le bailleur dehors.
 *
 * Les tentatives échouées passent par le même compteur que la connexion : on
 * ne veut pas offrir ici un oracle de mot de passe sans limite de débit.
 */
export async function changerMotDePasse(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaChangementMotDePasse.safeParse({
    motDePasseActuel: donnees.get('motDePasseActuel'),
    motDePasse: donnees.get('motDePasse'),
    confirmation: donnees.get('confirmation'),
  })

  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const bailleur = await bailleurCourant()

  // Le formulaire ne porte ni le nom ni l'email : le contrôle contextuel ne
  // peut se faire qu'ici, une fois le compte connu.
  const refus = refusMotDePasseContextuel(analyse.data.motDePasse, [
    bailleur.nom,
    bailleur.email,
    bailleur.telephone,
  ])
  if (refus) return { erreursChamps: { motDePasse: refus } }

  const blocage = await verifierBlocage(bailleur.email)
  if (blocage.bloque) {
    return {
      erreur:
        `Trop de tentatives. Réessayez dans ${blocage.minutesRestantes} minute` +
        `${blocage.minutesRestantes > 1 ? 's' : ''}.`,
    }
  }

  const supabase = await creerClientServeur()

  // Revérification du mot de passe actuel. `signInWithPassword` réémet la
  // session du même utilisateur : le bailleur n'est pas déconnecté.
  const { error: erreurReauth } = await supabase.auth.signInWithPassword({
    email: bailleur.email,
    password: analyse.data.motDePasseActuel,
  })

  if (erreurReauth) {
    await enregistrerTentative(bailleur.email, false, null)
    return {
      erreursChamps: { motDePasseActuel: 'Ce mot de passe ne correspond pas à votre compte.' },
    }
  }

  await enregistrerTentative(bailleur.email, true, null)

  const { error } = await supabase.auth.updateUser({ password: analyse.data.motDePasse })

  if (error) return { erreur: `Changement impossible : ${error.message}` }

  return {
    succes:
      'Mot de passe mis à jour. Vos autres sessions restent ouvertes : déconnectez-vous partout si vous soupçonnez un accès non autorisé.',
  }
}

// ─── Photo de profil ─────────────────────────────────────────────────────────

const TAILLE_MAX_PHOTO = 3 * 1024 * 1024

/**
 * Enregistre la photo de profil.
 *
 * ─── Ce que le serveur reçoit, et ce qu'il ne reçoit pas ────────────────────
 *
 * Un fichier image, et rien d'autre. L'analyse du visage a eu lieu dans le
 * navigateur : le serveur ne voit ni les positions des visages, ni une
 * empreinte, ni un score. Il ne saurait pas dire ce que la photo représente.
 *
 * Il refait en revanche les contrôles qui le concernent — poids et format réel,
 * lu sur les octets de tête — parce qu'une requête forgée ne passe pas par la
 * page. Le contrôle du navigateur sert le confort ; celui-ci sert la sécurité.
 *
 * Déposer une photo clôt la période d'avatar temporaire : `avatar_temporaire_depuis`
 * repasse à NULL, et le décompte cesse. L'avatar, lui, est conservé — il
 * redeviendra la représentation du bailleur si la photo est retirée.
 */
export async function televerserPhoto(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const bailleur = await bailleurCourant()
  const fichier = donnees.get('photo')

  if (!(fichier instanceof File) || fichier.size === 0) {
    return { erreur: 'Choisissez une photo.' }
  }

  if (fichier.size > TAILLE_MAX_PHOTO) {
    return { erreur: 'La photo ne doit pas dépasser 3 Mo.' }
  }

  const format = await reconnaitreFormat(fichier)
  if (!format) {
    return { erreur: 'Format non reconnu. Utilisez une image JPEG, PNG ou WebP.' }
  }

  const description = DESCRIPTION_FORMAT[format]
  const chemin = `${bailleur.id}/photo.${description.extension}`

  const supabase = await creerClientServeur()

  // L'extension peut changer d'un envoi à l'autre : l'ancien objet resterait
  // sinon dans le coffre, orphelin et invisible.
  if (bailleur.photo_chemin && bailleur.photo_chemin !== chemin) {
    await supabase.storage.from('photos').remove([bailleur.photo_chemin])
  }

  const { error: erreurDepot } = await supabase.storage
    .from('photos')
    .upload(chemin, fichier, { upsert: true, contentType: description.type })

  if (erreurDepot) {
    return { erreur: `L’enregistrement a échoué : ${erreurDepot.message}` }
  }

  const { error } = await supabase
    .from('bailleurs')
    .update({ photo_chemin: chemin, avatar_temporaire_depuis: null })
    .eq('id', bailleur.id)

  if (error) return { erreur: `L’enregistrement a échoué : ${error.message}` }

  revalidatePath('/app', 'layout')
  return { succes: 'Votre photo de profil est enregistrée.' }
}

/**
 * Retire la photo de profil.
 *
 * L'avatar reprend sa place — il n'a jamais été supprimé — et une nouvelle
 * période temporaire s'ouvre. Repartir de zéro plutôt que de reprendre le
 * décompte là où il s'était arrêté : quelqu'un qui retire sa photo a une raison
 * de le faire, et lui répondre « il vous reste zéro jour » serait absurde.
 */
export async function supprimerPhoto(): Promise<EtatFormulaire> {
  const bailleur = await bailleurCourant()
  if (!bailleur.photo_chemin) return { succes: 'Aucune photo à retirer.' }

  const supabase = await creerClientServeur()
  await supabase.storage.from('photos').remove([bailleur.photo_chemin])

  const { error } = await supabase
    .from('bailleurs')
    .update({ photo_chemin: null, avatar_temporaire_depuis: new Date().toISOString() })
    .eq('id', bailleur.id)

  if (error) return { erreur: `La suppression a échoué : ${error.message}` }

  revalidatePath('/app', 'layout')
  return { succes: 'Votre photo a été retirée. Votre avatar vous représente à nouveau.' }
}
