'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { messageCandidature } from '@/lib/candidatures/messages'
import { poserTemoinCandidature, retirerTemoinCandidature } from '@/lib/candidatures/temoin'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur, obtenirUtilisateur } from '@/lib/supabase/serveur'
import {
  canalDisponible,
  envoyerCodeTelephone,
  EXIGENCES_CANAL,
} from '@/lib/verification/canaux'
import {
  annulerCodeCourant,
  preparerCodeTelephone,
  secretOtpPresent,
  verifierCodeTelephone,
} from '@/lib/verification/otp'
import {
  LIBELLE_CANAL,
  MESSAGES_VERIFICATION,
  masquerTelephone,
  type CanalTelephone,
} from '@/lib/verification/regles'
import { erreursChamps, schemaInscription, schemaProfil, type EtatFormulaire } from '@/lib/validation'
import { poserTemoinVerification } from '@/lib/verification/temoin'

/**
 * Le parcours candidat — les trois gestes du visiteur de Sikaloc_Find.
 *
 * ─── Pourquoi une inscription à part ───────────────────────────────────────
 *
 * `/inscription` fabrique un bailleur : parrainage, nombre de logements,
 * avatar, et un profil créé par le déclencheur. Y greffer un choix de rôle,
 * c'est toucher au chemin par lequel passent toutes les créations de compte.
 *
 * Le projet a déjà tranché autrement pour les locataires : leur inscription
 * vit dans leur parcours (`rejoindreAvecInvitation`), pas dans `/inscription`.
 * Celle-ci fait pareil — `role: 'candidat'` dit au déclencheur de créer un
 * profil candidat, et rien d'autre.
 *
 * ─── Ce que le navigateur ne décide pas ────────────────────────────────────
 *
 * Ni le candidat — c'est la session —, ni l'annonce : la référence sert à
 * retrouver une annonce PUBLIÉE au moment de l'envoi, et c'est
 * `soumettre_candidature` (S8-A) qui tranche. Une annonce suspendue entre
 * l'affichage et l'envoi fait échouer l'envoi, pas passer la candidature.
 */

const REFERENCE = /^[0-9a-hjkmnp-tv-z]{10}$/

async function urlDeBase(): Promise<string> {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export async function inscrireCandidat(
  reference: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  if (!REFERENCE.test(reference)) return { erreur: messageCandidature('annonce_indisponible') }

  const analyse = schemaInscription.safeParse({
    nom: donnees.get('nom'),
    email: donnees.get('email'),
    telephone: donnees.get('telephone'),
    motDePasse: donnees.get('motDePasse'),
    codeParrain: '',
    avatar: '',
  })
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const { nom, email, telephone, motDePasse } = analyse.data
  const supabase = await creerClientServeur()

  const { error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      emailRedirectTo: `${await urlDeBase()}/verification`,
      // `role: 'candidat'` : le déclencheur crée un profil candidat et
      // s'arrête là. Aucun code de parrainage, aucun espace de gestion.
      data: { nom, telephone, role: 'candidat' },
    },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return {
        erreur:
          'Un compte existe déjà avec cette adresse. Connectez-vous, puis revenez à cette annonce.',
      }
    }
    return { erreur: 'La création du compte a échoué. Réessayez dans un instant.' }
  }

  // Deux témoins : l'adresse, pour l'écran de saisie du code ; l'annonce, pour
  // savoir où ramener quelqu'un qui revient de sa boîte mail.
  await poserTemoinVerification(email)
  await poserTemoinCandidature(reference)

  revalidatePath('/', 'layout')
  redirect('/verification')
}

export async function enregistrerProfilCandidat(
  reference: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const analyse = schemaProfil.safeParse({
    nom: donnees.get('nom'),
    telephone: donnees.get('telephone'),
    adresse: '',
  })
  if (!analyse.success) return { erreursChamps: erreursChamps(analyse.error) }

  const supabase = await creerClientServeur()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: messageCandidature('authentification_requise') }
  const { data, error } = await supabase.rpc('enregistrer_profil_candidat', {
    p_nom: analyse.data.nom,
    p_telephone: analyse.data.telephone,
  })

  if (error) {
    console.error('[candidatures] profil', error.code, error.message)
    return { erreur: messageCandidature('echec') }
  }
  const motif = data?.[0]?.motif
  if (motif !== 'ok') return { erreur: messageCandidature(motif) }

  // Le consentement WhatsApp vit à part du RPC de S8-A : le candidat écrit
  // lui-même sur sa propre ligne (RLS « Un candidat modifie son profil »). Une
  // case cochée vaut oui, absente vaut non — jamais un consentement supposé.
  const { data: profilMisAJour, error: erreurWhatsApp } = await supabase
    .from('candidats')
    .update({ notif_whatsapp: donnees.get('notifWhatsApp') === 'on' })
    .eq('id', user.id)
    .select('id')
    .maybeSingle()

  if (REFERENCE.test(reference)) revalidatePath(`/find/${reference}/candidater`)
  revalidatePath('/me/candidatures')
  if (erreurWhatsApp || !profilMisAJour) return {
    erreur: 'Profil enregistré, mais votre préférence WhatsApp n’a pas pu être sauvegardée. Réessayez.',
  }
  return { succes: 'Profil enregistré.' }
}

export async function envoyerCandidature(
  reference: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  if (!REFERENCE.test(reference)) return { erreur: messageCandidature('annonce_indisponible') }

  const message = String(donnees.get('message') ?? '').trim()
  if (message.length > 1000) {
    return { erreursChamps: { message: messageCandidature('message_trop_long') } }
  }

  const supabase = await creerClientServeur()
  const { data, error } = await supabase.rpc('soumettre_candidature', {
    p_reference: reference,
    p_message: message || null,
  })

  if (error) {
    console.error('[candidatures] envoi', error.code, error.message)
    return { erreur: messageCandidature('echec') }
  }
  const motif = data?.[0]?.motif
  if (motif !== 'ok') return { erreur: messageCandidature(motif) }

  await retirerTemoinCandidature()
  revalidatePath(`/find/${reference}/candidater`)
  revalidatePath('/me/candidatures')
  redirect(`/find/${reference}/candidater?envoyee=1`)
}

/**
 * La vérification du téléphone du candidat — le miroir strict de celle du
 * bailleur (S8-G).
 *
 * Elle passe par le MÊME service OTP (`otp.ts`), désormais clé sur le compte :
 * même empreinte HMAC jamais en clair, même expiration, mêmes cinq essais,
 * mêmes cinq demandes par heure, même délai de renvoi, même usage unique. Rien
 * n'est réécrit ; seul le rôle change.
 *
 * Aucun canal (SMS/WhatsApp) n'étant configuré, la demande se solde par
 * « canal indisponible » — exactement comme pour le bailleur. Le dispositif est
 * complet et prêt : le jour où un canal existe, il fonctionne sans y revenir.
 */

async function adresseIpCandidat(): Promise<string | null> {
  const enTetes = await headers()
  return enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function estCanalTelephone(valeur: unknown): valeur is CanalTelephone {
  return valeur === 'SMS' || valeur === 'WHATSAPP'
}

/** Le profil candidat du compte connecté, ou null. */
async function candidatCourant() {
  const utilisateur = await obtenirUtilisateur()
  if (!utilisateur) return null
  const supabase = await creerClientServeur()
  const { data } = await supabase
    .from('candidats')
    .select('id, telephone, telephone_verifie_le, notif_whatsapp')
    .eq('id', utilisateur.id)
    .maybeSingle()
  return data ?? null
}

export async function demanderCodeCandidat(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const canal = donnees.get('canal')
  if (!estCanalTelephone(canal)) {
    return { erreur: 'Choisissez comment recevoir votre code.' }
  }

  const candidat = await candidatCourant()
  if (!candidat) return { erreur: messageCandidature('authentification_requise') }

  if (candidat.telephone_verifie_le) {
    return { erreur: MESSAGES_VERIFICATION.deja_verifie }
  }

  if (!secretOtpPresent()) {
    return {
      erreur:
        'La vérification par code n’est pas encore configurée sur ce serveur. Contactez le support.',
    }
  }

  if (!canalDisponible(canal)) {
    return {
      erreur:
        `L’envoi par ${LIBELLE_CANAL[canal]} n’est pas encore disponible. ` +
        `Il reste à configurer : ${EXIGENCES_CANAL[canal][0]}`,
    }
  }

  const demande = await preparerCodeTelephone(
    candidat.id,
    candidat.telephone,
    canal,
    await adresseIpCandidat(),
  )

  if (!demande.ok || !demande.code) {
    const motif = demande.motif ?? 'code_absent'
    return {
      erreur:
        motif === 'renvoi_trop_tot' && demande.attendreSecondes
          ? `Patientez ${demande.attendreSecondes} seconde${demande.attendreSecondes > 1 ? 's' : ''} avant de demander un nouveau code.`
          : MESSAGES_VERIFICATION[motif],
    }
  }

  const envoi = await envoyerCodeTelephone(canal, candidat.telephone, demande.code)

  if (!envoi.ok) {
    // Jamais parti : ne pas le laisser valable, ni compter au quota.
    await annulerCodeCourant(candidat.id)
    return {
      erreur: envoi.indisponible
        ? `L’envoi par ${LIBELLE_CANAL[canal]} n’est pas encore disponible. Choisissez un autre canal.`
        : 'L’envoi du code a échoué. Réessayez dans un instant.',
    }
  }

  revalidatePath('/me/candidatures')
  return { succes: `Code envoyé par ${LIBELLE_CANAL[canal]} au ${masquerTelephone(candidat.telephone)}.` }
}

/**
 * Valide le code, et marque le numéro du candidat vérifié.
 *
 * L'écriture de `telephone_verifie_le` passe par le client d'administration :
 * on ne veut pas qu'un navigateur puisse s'attribuer une vérification sans code.
 */
export async function verifierCodeCandidat(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const code = String(donnees.get('code') ?? '').replace(/\D/g, '')

  const candidat = await candidatCourant()
  if (!candidat) return { erreur: messageCandidature('authentification_requise') }
  if (candidat.telephone_verifie_le) return { succes: 'Numéro déjà vérifié.' }

  const verdict = await verifierCodeTelephone(candidat.id, candidat.telephone, code)

  if (!verdict.ok) {
    const motif = verdict.motif ?? 'code_incorrect'
    const reste =
      motif === 'code_incorrect' && verdict.essaisRestants && verdict.essaisRestants > 0
        ? ` Il vous reste ${verdict.essaisRestants} essai${verdict.essaisRestants > 1 ? 's' : ''}.`
        : ''
    return { erreursChamps: { code: MESSAGES_VERIFICATION[motif] + reste } }
  }

  const admin = creerClientAdmin()
  const { error } = await admin
    .from('candidats')
    .update({ telephone_verifie_le: new Date().toISOString() })
    .eq('id', candidat.id)

  if (error) return { erreur: 'La vérification n’a pas pu être enregistrée. Réessayez.' }

  revalidatePath('/me/candidatures')
  return { succes: 'Numéro de téléphone vérifié.' }
}
