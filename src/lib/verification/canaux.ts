import 'server-only'

import { formaterTelephone } from '@/lib/telephone'
import { LIBELLE_CANAL, type CanalTelephone } from '@/lib/verification/regles'

/**
 * Les canaux par lesquels un code peut atteindre un téléphone.
 *
 * ─── Ce que ce fichier est, et ce qu'il n'est pas ───────────────────────────
 *
 * C'est la couche de transport, et seulement elle. Elle ne génère pas de code,
 * ne compte pas de tentative, ne décide de rien : elle reçoit un numéro et un
 * texte, et dit si le message est parti. `otp.ts` détient toute la logique.
 *
 * La séparation a une raison pratique : le jour où un fournisseur SMS est
 * branché, seul ce fichier change. Et si demain il faut basculer de Twilio à
 * un opérateur local béninois, la logique OTP n'en saura rien.
 *
 * ─── AUCUN FOURNISSEUR N'EST CONFIGURÉ ─────────────────────────────────────
 *
 * À l'écriture de ces lignes, Sikaloc ne peut envoyer ni SMS ni message
 * WhatsApp. Vérifié, pas supposé :
 *
 *   · `[auth.sms]` de `supabase/config.toml` : `enabled = false`
 *   · `[auth.sms.twilio]` : `enabled = false`, aucun identifiant
 *   · `src/lib/whatsapp.ts` ne construit que des liens `wa.me` que le bailleur
 *     ouvre lui-même — ce n'est pas une API d'envoi
 *   · aucune variable d'environnement de fournisseur SMS ou WhatsApp
 *
 * Les deux canaux renvoient donc `indisponible`. Ils ne font pas semblant
 * d'avoir envoyé : un envoi simulé qui réussit à l'écran produirait des
 * comptes que personne ne peut vérifier, et une confiance fausse dans un
 * dispositif de sécurité.
 *
 * Ce qu'il faut pour les allumer est écrit dans `EXIGENCES_CANAL`, et rien
 * d'autre n'aura besoin de changer.
 */

export interface ResultatEnvoi {
  ok: boolean
  /** Renseigné quand l'envoi échoue. Jamais montré tel quel à l'utilisateur. */
  motifTechnique?: string
  /** Vrai quand le canal n'est pas configuré, par opposition à un échec d'envoi. */
  indisponible?: boolean
}

/** Ce qu'il manque pour qu'un canal fonctionne. */
export const EXIGENCES_CANAL: Record<CanalTelephone, string[]> = {
  SMS: [
    'Un compte chez un fournisseur SMS couvrant le Bénin (Twilio, Vonage, ou un agrégateur local).',
    'Les variables SMS_FOURNISSEUR, SMS_IDENTIFIANT, SMS_JETON, SMS_EXPEDITEUR.',
    'Un identifiant d’expéditeur déclaré auprès de l’ARCEP si un nom d’expéditeur est souhaité.',
  ],
  WHATSAPP: [
    'Un compte WhatsApp Business Platform (Meta Cloud API) ou un accès Twilio WhatsApp.',
    'Les variables WHATSAPP_ID_TELEPHONE et WHATSAPP_JETON.',
    'Un gabarit de message d’authentification approuvé par Meta — les messages hors gabarit sont refusés en envoi sortant.',
  ],
}

/**
 * Trappe de développement : le code s'affiche dans la console du serveur au
 * lieu de partir.
 *
 * ─── Pourquoi elle existe ──────────────────────────────────────────────────
 *
 * Sans elle, le parcours téléphone est intestable jusqu'à ce qu'un contrat
 * soit signé avec un opérateur. Or c'est le parcours qu'il faut pouvoir
 * essayer soi-même, sur un vrai écran, avant de payer quoi que ce soit.
 *
 * ─── Pourquoi elle ne peut pas s'ouvrir en production ──────────────────────
 *
 * Deux verrous, tous les deux nécessaires :
 *
 *   · `NODE_ENV !== 'production'` — Vercel impose `production` à toute
 *     compilation déployée, ce verrou n'est pas contournable par oubli de
 *     configuration ;
 *   · `OTP_CANAL_DEV` doit valoir exactement « 1 », ce qui demande un geste
 *     explicite.
 *
 * Ce n'est donc pas un envoi simulé qui se ferait passer pour réel : en
 * production, les deux canaux restent indisponibles et l'écran le dit.
 * Et le code n'est JAMAIS écrit dans un journal de production — c'est
 * précisément ce que ce double verrou garantit.
 */
function trappeDeveloppement(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.OTP_CANAL_DEV === '1'
}

/** Le canal est-il réellement en état d'envoyer ? */
export function canalDisponible(canal: CanalTelephone): boolean {
  if (trappeDeveloppement()) return true

  switch (canal) {
    case 'SMS':
      return Boolean(process.env.SMS_FOURNISSEUR && process.env.SMS_JETON)
    case 'WHATSAPP':
      return Boolean(process.env.WHATSAPP_ID_TELEPHONE && process.env.WHATSAPP_JETON)
  }
}

/**
 * Le texte envoyé au téléphone.
 *
 * Court, sans lien, et sans nom de destinataire. Un SMS se lit sur un écran
 * verrouillé, parfois par quelqu'un d'autre : il n'a pas à révéler qui possède
 * le numéro. « Ne le communiquez à personne » est là parce que c'est
 * exactement ce qu'un escroc demandera.
 */
export function messageCode(code: string): string {
  return (
    `Sikaloc : votre code de vérification est ${code}. ` +
    `Il expire dans 10 minutes. Ne le communiquez à personne.`
  )
}

/**
 * Envoie un code à un téléphone, par le canal demandé.
 *
 * C'est la seule porte de sortie vers l'extérieur. `otp.ts` ne connaît que
 * cette fonction, et ne sait rien de Twilio, de Meta ni d'aucun autre nom.
 *
 * Le code n'est jamais journalisé — ni ici, ni dans les couches en dessous.
 */
export async function envoyerCodeTelephone(
  canal: CanalTelephone,
  telephoneCanonique: string,
  code: string,
): Promise<ResultatEnvoi> {
  if (!canalDisponible(canal)) {
    return {
      ok: false,
      indisponible: true,
      motifTechnique:
        `Canal ${LIBELLE_CANAL[canal]} non configuré. ` +
        `Manque : ${EXIGENCES_CANAL[canal].join(' ')}`,
    }
  }

  if (trappeDeveloppement()) {
    // Hors production uniquement, et sur demande explicite. Voir
    // `trappeDeveloppement()` pour les deux verrous.
    console.log(
      `\n  [développement] Code ${LIBELLE_CANAL[canal]} pour ` +
        `${formaterTelephone(telephoneCanonique)} : ${code}\n`,
    )
    return { ok: true }
  }

  switch (canal) {
    case 'SMS':
      return envoyerSms(telephoneCanonique, messageCode(code))
    case 'WHATSAPP':
      return envoyerWhatsApp(telephoneCanonique, code)
  }
}

// ─── Les deux transports ────────────────────────────────────────────────────
//
// Les corps sont vides à dessein. Ils ne sont atteints que si les variables
// d'environnement correspondantes existent, c'est-à-dire le jour où quelqu'un
// aura ouvert un compte chez un fournisseur — et ce jour-là, la forme exacte de
// la requête dépendra du fournisseur retenu. Écrire maintenant un appel à
// Twilio « au cas où » serait écrire du code jamais exécuté, jamais testé, et
// probablement faux.

async function envoyerSms(
  telephoneCanonique: string,
  _message: string,
): Promise<ResultatEnvoi> {
  return {
    ok: false,
    indisponible: true,
    motifTechnique:
      `Transport SMS à implémenter pour le fournisseur ` +
      `« ${process.env.SMS_FOURNISSEUR} » (destinataire ${formaterTelephone(telephoneCanonique)}).`,
  }
}

async function envoyerWhatsApp(
  telephoneCanonique: string,
  _code: string,
): Promise<ResultatEnvoi> {
  return {
    ok: false,
    indisponible: true,
    motifTechnique:
      `Transport WhatsApp à implémenter : un gabarit d’authentification ` +
      `approuvé est requis (destinataire ${formaterTelephone(telephoneCanonique)}).`,
  }
}

/** Les canaux réellement proposables à l'utilisateur, à cet instant. */
export function canauxDisponibles(): CanalTelephone[] {
  return (['SMS', 'WHATSAPP'] as CanalTelephone[]).filter(canalDisponible)
}

/** Vrai quand les codes ne partent pas vraiment — pour le dire à l'écran. */
export function enModeDeveloppement(): boolean {
  return trappeDeveloppement()
}
