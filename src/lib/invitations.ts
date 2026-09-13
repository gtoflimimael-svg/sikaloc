import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Les jetons d'invitation.
 *
 * ─── Ce qu'un jeton ouvre ───────────────────────────────────────────────────
 *
 * L'accès aux documents de loyer d'une personne : son bail, ses paiements, ses
 * quittances. C'est beaucoup plus qu'un code à six chiffres, et la protection
 * est dimensionnée en conséquence — 32 octets tirés du générateur
 * cryptographique, soit de quoi rendre le devinage sans objet.
 *
 * ─── Ce qui est stocké ──────────────────────────────────────────────────────
 *
 * L'empreinte, jamais le jeton. Un jeton en clair dans la table serait
 * utilisable tel quel par quiconque lirait une sauvegarde. Le secret qui
 * calcule l'empreinte vit dans l'environnement, pas en base : il ne fuit donc
 * pas avec elle.
 *
 * Même secret que les codes de vérification — `OTP_SECRET`. En avoir deux
 * n'aurait rien protégé de plus, et aurait doublé les chances qu'un des deux
 * manque le jour du déploiement.
 */

/**
 * Sept jours.
 *
 * Assez pour qu'un locataire qui relève ses mails une fois par semaine ne rate
 * pas la sienne. Pas au point qu'une invitation oubliée dans une boîte reste
 * ouverte des mois — surtout si le locataire a quitté le logement entre-temps.
 */
export const VALIDITE_JOURS = 7

/** Longueur du jeton en octets, avant encodage. */
const OCTETS_JETON = 32

function secret(): string {
  const valeur = process.env.OTP_SECRET
  if (!valeur || valeur.length < 32) {
    throw new Error('OTP_SECRET absente ou trop courte (32 caractères minimum).')
  }
  return valeur
}

export function secretPresent(): boolean {
  const valeur = process.env.OTP_SECRET
  return Boolean(valeur && valeur.length >= 32)
}

/** L'empreinte HMAC d'un jeton. Seule elle est écrite en base. */
export function empreinteJeton(jeton: string): string {
  return createHmac('sha256', secret()).update(jeton).digest('hex')
}

/**
 * Un jeton neuf et son empreinte.
 *
 * Le jeton n'est rendu qu'ici, une seule fois, pour être glissé dans le lien.
 * Rien ne le conserve ensuite — ni la base, ni un journal.
 *
 * `base64url` plutôt que `hex` : même entropie, une URL deux fois plus courte,
 * et aucun caractère à échapper.
 */
export function creerJeton(): { jeton: string; empreinte: string } {
  const jeton = randomBytes(OCTETS_JETON).toString('base64url')
  return { jeton, empreinte: empreinteJeton(jeton) }
}

/**
 * Comparaison à temps constant de deux empreintes.
 *
 * La recherche en base se fait par égalité sur l'empreinte, ce qui suffit.
 * Cette fonction sert aux vérifications applicatives, où un `===` sur des
 * chaînes s'arrête au premier octet différent et laisse la durée de la réponse
 * trahir combien d'octets étaient corrects.
 */
export function empreintesEgales(a: string, b: string): boolean {
  try {
    const ta = Buffer.from(a, 'hex')
    const tb = Buffer.from(b, 'hex')
    return ta.length === tb.length && timingSafeEqual(ta, tb)
  } catch {
    return false
  }
}

/** Le lien qu'on met dans l'email. */
export function lienInvitation(jeton: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  return `${base}/me/invitation/${jeton}`
}

export function expiration(): string {
  return new Date(Date.now() + VALIDITE_JOURS * 24 * 60 * 60 * 1000).toISOString()
}

// ─── Les réponses possibles ─────────────────────────────────────────────────

export type MotifInvitation =
  | 'ok'
  | 'authentification_requise'
  | 'introuvable'
  | 'deja_utilisee'
  | 'annulee'
  | 'expiree'
  | 'deja_rattache'

/**
 * Ce qu'on dit au locataire.
 *
 * « Introuvable » couvre aussi bien un lien tronqué qu'un jeton inventé : on ne
 * cherche pas à distinguer, faute de quoi ce message deviendrait un moyen de
 * savoir quels jetons existent.
 */
export const MESSAGES_INVITATION: Record<MotifInvitation, string> = {
  ok: 'Invitation acceptée.',
  authentification_requise: 'Connectez-vous pour accepter cette invitation.',
  introuvable:
    'Ce lien n’est pas valable. Demandez une nouvelle invitation à votre bailleur.',
  deja_utilisee:
    'Cette invitation a déjà servi. Si ce n’était pas vous, prévenez votre bailleur.',
  annulee:
    'Cette invitation a été annulée. Demandez-en une nouvelle à votre bailleur.',
  expiree: `Cette invitation a expiré après ${VALIDITE_JOURS} jours. Demandez-en une nouvelle à votre bailleur.`,
  deja_rattache:
    'Ce logement est déjà rattaché à un autre compte. Contactez votre bailleur.',
}

export type MotifRefusEnvoi =
  | 'sans_email'
  | 'deja_rattache'
  | 'trop_tot'
  | 'secret_absent'
  | 'envoi_echoue'

export const MESSAGES_ENVOI: Record<MotifRefusEnvoi, string> = {
  sans_email:
    'Ce locataire n’a pas d’adresse email. Ajoutez-la sur sa fiche pour pouvoir l’inviter.',
  deja_rattache: 'Ce locataire a déjà un accès à Sikaloc_Me.',
  trop_tot:
    'Une invitation vient d’être envoyée. Patientez quelques minutes avant d’en renvoyer une.',
  secret_absent:
    'Les invitations ne sont pas encore configurées sur ce serveur. Contactez le support.',
  envoi_echoue: 'L’email n’a pas pu partir. Réessayez dans un instant.',
}

/** Deux minutes entre deux envois pour le même locataire. */
export const DELAI_RENVOI_SECONDES = 120
