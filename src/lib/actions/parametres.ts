'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { droits, MESSAGE_ECRITURE_BLOQUEE } from '@/lib/acces'
import { ESPACE_PRO } from '@/lib/roles'
import { bailleurAvecEcriture, bailleurCourant } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import { DESCRIPTION_FORMAT, reconnaitreFormat } from '@/lib/signature/fichier'
import type { Bailleur } from '@/lib/types/database'
import { enregistrerTentative, verifierBlocage } from '@/lib/rate-limit'
import {
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
  revalidatePath('/pro', 'layout')
  return { succes: 'Informations mises à jour.' }
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

  revalidatePath('/pro/parametres')
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
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat

  const resultat = await enregistrerSignaturePourBailleur(acces.bailleur, donnees)
  if (resultat.erreur) return resultat

  revalidatePath('/pro/parametres')
  return resultat
}

/**
 * Enregistre la signature pendant l'onboarding puis clôture celui-ci.
 *
 * Le garde métier habituel impose que l'onboarding soit déjà terminé. Ici,
 * on garde l'authentification, l'identité et les droits d'écriture, mais on ne
 * pose pas cette condition avant l'action qui doit précisément la satisfaire.
 */
export async function televerserSignatureOnboarding(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const bailleur = await bailleurCourant()
  if (!droits(bailleur).peutEcrire) {
    return { erreur: MESSAGE_ECRITURE_BLOQUEE }
  }

  const resultat = await enregistrerSignaturePourBailleur(bailleur, donnees)
  if (resultat.erreur) {
    // Si le fichier a été persisté mais que la finalisation échoue ensuite,
    // l'écran relit le profil et permet de terminer sans renvoyer la signature.
    revalidatePath('/pro/onboarding')
    return resultat
  }

  let onboardingTermine = false
  try {
    const supabase = await creerClientServeur()
    const { data: profil, error } = await supabase
      .from('bailleurs')
      .update({ onboarding_termine: true })
      .eq('id', bailleur.id)
      .select('onboarding_termine')
      .single()

    onboardingTermine = !error && profil?.onboarding_termine === true
  } catch {
    onboardingTermine = false
  }

  if (!onboardingTermine) {
    revalidatePath('/pro/onboarding')
    return {
      erreur:
        'Votre signature est enregistrée, mais la configuration n’a pas pu être terminée. ' +
        'Actualisez la page puis choisissez « Voir mon tableau de bord ».',
    }
  }

  revalidatePath('/pro', 'layout')
  redirect(`${ESPACE_PRO.tableauDeBord}?bienvenue=1`)
}

async function enregistrerSignaturePourBailleur(
  bailleur: Bailleur,
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
  let format: Awaited<ReturnType<typeof reconnaitreFormat>>
  try {
    format = await reconnaitreFormat(fichier)
  } catch {
    return { erreur: 'L’image n’a pas pu être lue. Gardez votre tracé et réessayez.' }
  }

  if (!format) {
    return { erreur: 'Formats acceptés : PNG, JPEG ou WebP.' }
  }

  const { type: typeReel, extension } = DESCRIPTION_FORMAT[format]

  const chemin = `${bailleur.id}/signature.${extension}`
  try {
    const supabase = await creerClientServeur()
    const { error: erreurUpload } = await supabase.storage
      .from('signatures')
      .upload(chemin, fichier, { contentType: typeReel, upsert: true })

    if (erreurUpload) {
      return { erreur: 'Le téléversement a échoué. Gardez votre tracé et réessayez.' }
    }

    const { error: erreurRpc } = await supabase.rpc('definir_signature_bailleur', {
      p_chemin: chemin,
    })

    if (erreurRpc) {
      if (bailleur.signature_chemin !== chemin) {
        await supabase.storage.from('signatures').remove([chemin])
      }
      return { erreur: 'La signature n’a pas pu être enregistrée. Gardez votre tracé et réessayez.' }
    }

    // Confirmer la référence persistée du compte authentifié avant d'annoncer
    // la réussite ou de clôturer l'onboarding.
    const { data: profil, error: erreurLecture } = await supabase
      .from('bailleurs')
      .select('signature_chemin')
      .eq('id', bailleur.id)
      .single()

    if (erreurLecture || profil?.signature_chemin !== chemin) {
      return {
        erreur:
          'Le fichier a été transmis, mais sa sauvegarde n’a pas pu être confirmée. ' +
          'Actualisez la page avant de réessayer.',
      }
    }

    // Un changement d'extension laisserait l'ancien fichier derrière lui.
    if (bailleur.signature_chemin && bailleur.signature_chemin !== chemin) {
      await supabase.storage.from('signatures').remove([bailleur.signature_chemin])
    }

    return { succes: 'Signature enregistrée. Elle apparaîtra sur vos prochaines quittances.' }
  } catch {
    return { erreur: 'Une erreur réseau a interrompu l’enregistrement. Gardez votre tracé et réessayez.' }
  }
}

export async function supprimerSignature(): Promise<EtatFormulaire> {
  const acces = await bailleurAvecEcriture()
  if (!acces.ok) return acces.etat
  const bailleur = acces.bailleur
  const supabase = await creerClientServeur()

  const { error } = await supabase.rpc('definir_signature_bailleur', { p_chemin: null })

  if (error) return { erreur: `Suppression impossible : ${error.message}` }

  if (bailleur.signature_chemin) {
    await supabase.storage.from('signatures').remove([bailleur.signature_chemin])
  }

  revalidatePath('/pro/parametres')
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
