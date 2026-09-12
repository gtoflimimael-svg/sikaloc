'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { bailleurNonVerifie } from '@/lib/session'
import { creerClientAdmin } from '@/lib/supabase/admin'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { EtatFormulaire } from '@/lib/validation'
import {
  canalDisponible,
  envoyerCodeTelephone,
  EXIGENCES_CANAL,
} from '@/lib/verification/canaux'
import { etatVerification } from '@/lib/verification/etat'
import {
  annulerCodeCourant,
  attenteAvantRenvoi,
  preparerCodeTelephone,
  secretOtpPresent,
  verifierCodeTelephone,
} from '@/lib/verification/otp'
import {
  LIBELLE_CANAL,
  LONGUEUR_CODE,
  MESSAGES_VERIFICATION,
  masquerEmail,
  masquerTelephone,
  type CanalTelephone,
} from '@/lib/verification/regles'
import {
  poserTemoinVerification,
  retirerTemoinVerification,
} from '@/lib/verification/temoin'

/**
 * Les actions de vérification du compte.
 *
 * ─── Deux mécanismes, et c'est assumé ──────────────────────────────────────
 *
 *   email      GoTrue génère, envoie (SMTP Resend) et valide son code
 *   téléphone  Sikaloc génère, envoie (SMS/WhatsApp) et valide le sien
 *
 * Pour l'email, réimplémenter ce que GoTrue fait déjà aurait voulu dire écrire
 * un second mécanisme de sécurité à côté d'un mécanisme éprouvé, et maintenir
 * les deux. Pour le téléphone, il n'y avait pas le choix : GoTrue ne parle pas
 * WhatsApp, et aucun fournisseur SMS n'est branché sur le projet.
 *
 * L'effet de bord est une garantie gratuite : un code email ne peut pas valider
 * un téléphone, et l'inverse non plus. Ils ne vivent pas dans le même système.
 *
 * ─── Ce que ces actions ne disent jamais ───────────────────────────────────
 *
 * Ni le code, ni l'adresse complète, ni le numéro complet. Les messages
 * d'erreur ne distinguent pas « mauvais code » de « code inexistant » plus
 * finement que nécessaire : chaque nuance de plus est un renseignement offert.
 */

async function adresseIp(): Promise<string | null> {
  const enTetes = await headers()
  return enTetes.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
}

function estCanal(valeur: unknown): valeur is CanalTelephone {
  return valeur === 'SMS' || valeur === 'WHATSAPP'
}

// ═══ Email ═══════════════════════════════════════════════════════════════════

/**
 * Valide le code à six chiffres reçu par email.
 *
 * `verifyOtp` fait tout : il compare le code, marque l'email confirmé et ouvre
 * la session. C'est le remplaçant exact de l'ancien `exchangeCodeForSession`,
 * avec un code saisi à la place d'un lien cliqué.
 */
export async function verifierCodeEmail(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const email = String(donnees.get('email') ?? '').trim().toLowerCase()
  const code = String(donnees.get('code') ?? '').replace(/\D/g, '')

  if (!email) return { erreur: MESSAGES_VERIFICATION.code_absent }

  if (code.length !== LONGUEUR_CODE) {
    return { erreursChamps: { code: MESSAGES_VERIFICATION.code_incorrect } }
  }

  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })

  if (error) {
    // ─── Pourquoi un seul message pour deux causes ───────────────────────
    //
    // GoTrue répond « Token has expired or is invalid » et ne tranche jamais :
    // il ne veut pas dire à un attaquant si le code existait. On ne peut donc
    // pas être plus précis que lui.
    //
    // Une version précédente essayait quand même, en cherchant « expired »
    // dans le message — qui contient les deux mots. Résultat : un code
    // simplement faux affichait « ce code a expiré », et le bailleur allait
    // redemander un code alors que le sien était valable.
    return {
      erreursChamps: { code: MESSAGES_VERIFICATION.code_incorrect_ou_expire },
    }
  }

  // L'adresse est confirmée et la session ouverte : le témoin n'a plus d'objet.
  await retirerTemoinVerification()

  revalidatePath('/', 'layout')
  return { succes: 'Adresse email vérifiée.' }
}

/** Renvoie un code email. GoTrue applique son propre délai minimal (1 minute). */
export async function renvoyerCodeEmail(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const email = String(donnees.get('email') ?? '').trim().toLowerCase()
  if (!email) return { erreur: MESSAGES_VERIFICATION.code_absent }

  const supabase = await creerClientServeur()
  const { error } = await supabase.auth.resend({ type: 'signup', email })

  if (error) {
    if (/rate|frequency|seconds/i.test(error.message)) {
      return { erreur: MESSAGES_VERIFICATION.renvoi_trop_tot }
    }
    // Ne jamais confirmer ni démentir l'existence d'un compte : la réponse est
    // la même que celle d'un envoi réussi.
    return { succes: `Un nouveau code a été envoyé à ${masquerEmail(email)}.` }
  }

  return { succes: `Un nouveau code a été envoyé à ${masquerEmail(email)}.` }
}

/**
 * Reprise du parcours quand il ne reste plus ni session ni témoin.
 *
 * Le cas est banal : on ferme l'onglet et on revient le lendemain. Comme
 * l'email n'est pas encore confirmé, GoTrue refuse la connexion par mot de
 * passe — l'adresse est donc le seul point d'entrée possible.
 *
 * La réponse ne dit jamais si le compte existe. Pose le témoin dans tous les
 * cas et renvoie vers l'écran de saisie : un compte inconnu aboutit au même
 * écran, où aucun code n'arrivera jamais. C'est ce qui empêche ce formulaire de
 * devenir un annuaire des inscrits de Sikaloc.
 */
export async function reprendreVerificationEmail(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const email = String(donnees.get('email') ?? '').trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return { erreursChamps: { email: 'Adresse email invalide.' } }
  }

  await poserTemoinVerification(email)

  const supabase = await creerClientServeur()
  // L'erreur éventuelle est volontairement ignorée : la divulguer reviendrait
  // à confirmer ou démentir l'existence du compte.
  await supabase.auth.resend({ type: 'signup', email })

  redirect('/verification')
}

// ═══ Téléphone ═══════════════════════════════════════════════════════════════

/**
 * Demande un code pour le téléphone, par le canal choisi.
 *
 * L'ordre est important : on prépare le code (ce qui applique les limites),
 * puis on tente l'envoi, et si l'envoi échoue on annule le code. Sans cette
 * annulation, un canal indisponible consommerait le quota horaire du bailleur
 * et bloquerait le canal qui, lui, fonctionne.
 */
export async function demanderCodeTelephone(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const canal = donnees.get('canal')
  if (!estCanal(canal)) {
    return { erreur: 'Choisissez comment recevoir votre code.' }
  }

  const bailleur = await bailleurNonVerifie()
  const etat = await etatVerification(bailleur)

  if (etat.telephoneVerifie) {
    return { erreur: MESSAGES_VERIFICATION.deja_verifie }
  }

  // L'email d'abord : l'ordre du parcours est une règle serveur, pas une
  // suggestion de l'interface.
  if (!etat.emailVerifie) {
    return { erreur: 'Vérifiez d’abord votre adresse email.' }
  }

  if (!secretOtpPresent()) {
    return {
      erreur:
        'La vérification par code n’est pas encore configurée sur ce serveur. ' +
        'Contactez le support.',
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
    bailleur.id,
    bailleur.telephone,
    canal,
    await adresseIp(),
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

  const envoi = await envoyerCodeTelephone(canal, bailleur.telephone, demande.code)

  if (!envoi.ok) {
    // Le code n'est jamais parti : il ne doit pas rester valable, ni compter
    // dans le quota.
    await annulerCodeCourant(bailleur.id)

    return {
      erreur: envoi.indisponible
        ? `L’envoi par ${LIBELLE_CANAL[canal]} n’est pas encore disponible. Choisissez un autre canal.`
        : 'L’envoi du code a échoué. Réessayez dans un instant.',
    }
  }

  revalidatePath('/verification')
  return {
    succes: `Code envoyé par ${LIBELLE_CANAL[canal]} au ${masquerTelephone(bailleur.telephone)}.`,
  }
}

/**
 * Valide le code reçu sur le téléphone, et marque le numéro vérifié.
 *
 * L'écriture passe par le client d'administration : `bailleurs` n'accorde à
 * `authenticated` qu'un UPDATE sur ses propres lignes, et l'on ne veut
 * précisément pas qu'un navigateur puisse écrire `telephone_verifie_le`.
 */
export async function verifierCodeTelephoneAction(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const code = String(donnees.get('code') ?? '').replace(/\D/g, '')

  const bailleur = await bailleurNonVerifie()
  const etat = await etatVerification(bailleur)

  if (etat.telephoneVerifie) return { succes: 'Numéro déjà vérifié.' }
  if (!etat.emailVerifie) {
    return { erreur: 'Vérifiez d’abord votre adresse email.' }
  }

  const verdict = await verifierCodeTelephone(bailleur.id, bailleur.telephone, code)

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
    .from('bailleurs')
    .update({
      telephone_verifie_le: new Date().toISOString(),
      telephone_canal_verification: verdict.canal ?? null,
    })
    .eq('id', bailleur.id)

  if (error) {
    return { erreur: 'La vérification n’a pas pu être enregistrée. Réessayez.' }
  }

  revalidatePath('/', 'layout')
  return { succes: 'Numéro de téléphone vérifié.' }
}

/** Secondes restantes avant qu'un renvoi téléphone soit accepté. */
export async function attenteRenvoiTelephone(): Promise<number> {
  const bailleur = await bailleurNonVerifie()
  return attenteAvantRenvoi(bailleur.id)
}
