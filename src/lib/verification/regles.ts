/**
 * Les règles de vérification d'un compte Sikaloc.
 *
 * Ce fichier est pur : aucune dépendance, aucun accès réseau, aucun accès base.
 * Il est importable du navigateur comme du serveur, et c'est ce qui garantit
 * que l'écran et la décision d'autorisation appliquent la même règle.
 *
 * ─── La règle, en une phrase ────────────────────────────────────────────────
 *
 * Un compte est pleinement vérifié quand l'email ET le téléphone l'ont été.
 * Pas l'un ou l'autre. Les deux.
 *
 * Ce n'est pas une précaution administrative. Sikaloc envoie des quittances et
 * des relances sur le numéro saisi à l'inscription : un numéro non vérifié,
 * c'est un document de loyer qui part chez un inconnu.
 */

// ─── Étapes ─────────────────────────────────────────────────────────────────

export type EtapeVerification = 'email' | 'telephone'

/** Les deux canaux par lesquels un code peut atteindre un téléphone. */
export type CanalTelephone = 'SMS' | 'WHATSAPP'

export const CANAUX_TELEPHONE: CanalTelephone[] = ['SMS', 'WHATSAPP']

export const LIBELLE_CANAL: Record<CanalTelephone, string> = {
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
}

// ─── L'état d'un compte ─────────────────────────────────────────────────────

export interface EtatVerification {
  emailVerifie: boolean
  telephoneVerifie: boolean
}

/**
 * La règle métier fondamentale.
 *
 * Écrite une seule fois, appelée partout. Un `&&` recopié dans dix fichiers
 * finit par devenir un `||` dans le onzième.
 */
export function comptePleinementVerifie(etat: EtatVerification): boolean {
  return etat.emailVerifie === true && etat.telephoneVerifie === true
}

/**
 * L'étape à présenter maintenant, ou `null` si tout est fait.
 *
 * L'ordre compte : l'email d'abord, parce que c'est lui qui ouvre la session.
 * Tant qu'il n'est pas vérifié, il n'y a pas de session pour porter la
 * vérification du téléphone.
 */
export function etapeCourante(etat: EtatVerification): EtapeVerification | null {
  if (!etat.emailVerifie) return 'email'
  if (!etat.telephoneVerifie) return 'telephone'
  return null
}

/** « 1 étape restante », pour l'indicateur de progression. */
export function etapesRestantes(etat: EtatVerification): number {
  return (etat.emailVerifie ? 0 : 1) + (etat.telephoneVerifie ? 0 : 1)
}

// ─── Masquage des coordonnées ───────────────────────────────────────────────
//
// Ce qu'on affiche est un rappel, pas une divulgation. Assez pour reconnaître
// sa propre adresse, pas assez pour qu'un écran regardé par-dessus l'épaule la
// livre en entier.

/** `moussa.adjovi@exemple.bj` → `mo***@exemple.bj` */
export function masquerEmail(email: string): string {
  const arobase = email.lastIndexOf('@')
  if (arobase <= 0) return '***'

  const local = email.slice(0, arobase)
  const domaine = email.slice(arobase)
  const visible = local.slice(0, Math.min(2, local.length))

  return `${visible}***${domaine}`
}

/** `+2290190459821` → `+229 01 ** ** 21` */
export function masquerTelephone(canonique: string): string {
  const chiffres = canonique.replace(/\D/g, '').slice(-10)
  if (chiffres.length < 10) return '+229 ** ** ** ** **'

  const paires = chiffres.match(/\d{2}/g) ?? []
  // Premières et dernières paires visibles : de quoi reconnaître son numéro
  // sans l'exposer.
  return `+229 ${paires[0]} ** ** ${paires[4]}`
}

// ─── Réglages du code ───────────────────────────────────────────────────────

/**
 * Six chiffres. C'est ce qu'on retient le temps de passer d'une application à
 * l'autre, et c'est aussi la longueur que tout le monde attend d'un code reçu
 * par SMS.
 *
 * Six chiffres, ce sont un million de combinaisons. Ce n'est pas beaucoup —
 * c'est pourquoi la sécurité ne repose pas sur la longueur, mais sur les trois
 * limites qui suivent.
 */
export const LONGUEUR_CODE = 6

/**
 * Dix minutes.
 *
 * Assez pour aller chercher son téléphone, le déverrouiller, ouvrir la bonne
 * application. Trop peu pour qu'un code noté sur un papier serve le lendemain.
 */
export const VALIDITE_MINUTES = 10

/**
 * Cinq essais par code.
 *
 * Avec un million de combinaisons, cinq essais laissent une chance sur deux
 * cent mille. Le sixième essai n'est pas refusé « pour cette fois » : le code
 * est brûlé, il faut en demander un nouveau.
 */
export const TENTATIVES_MAXIMALES = 5

/**
 * Soixante secondes entre deux demandes.
 *
 * C'est l'attente affichée à l'écran, et c'est aussi la règle appliquée par le
 * serveur — un compte à rebours dans le navigateur n'empêche personne de
 * rejouer la requête.
 */
export const DELAI_RENVOI_SECONDES = 60

/**
 * Cinq codes par heure et par compte.
 *
 * Au-delà, ce n'est plus quelqu'un qui n'a rien reçu : c'est soit un problème
 * qu'un nouveau code ne réglera pas, soit quelqu'un qui se sert de Sikaloc pour
 * faire sonner le téléphone d'un autre. Les SMS se paient, en argent comme en
 * tranquillité.
 */
export const DEMANDES_MAXIMALES_PAR_HEURE = 5

// ─── Messages ───────────────────────────────────────────────────────────────
//
// Écrits ici pour que l'écran et le serveur disent exactement la même chose.
// Volontairement dépourvus de détail utile à une attaque : « code incorrect »
// ne dit pas si le code existait, s'il était expiré ou s'il visait l'email.

export type MotifRefus =
  | 'code_incorrect'
  | 'code_expire'
  | 'code_incorrect_ou_expire'
  | 'code_absent'
  | 'tentatives_epuisees'
  | 'trop_de_demandes'
  | 'renvoi_trop_tot'
  | 'canal_indisponible'
  | 'deja_verifie'

export const MESSAGES_VERIFICATION: Record<MotifRefus, string> = {
  code_incorrect: 'Ce code est incorrect. Vérifiez les chiffres saisis.',
  code_expire: 'Ce code a expiré. Demandez un nouveau code.',
  // Pour l'email, GoTrue répond « Token has expired or is invalid » sans jamais
  // trancher — et c'est délibéré de sa part : distinguer les deux dirait à un
  // attaquant si le code existait. On ne peut donc pas être plus précis, et
  // prétendre l'être produisait un « ce code a expiré » sur un code simplement
  // faux, qui envoyait le bailleur redemander un code parfaitement valable.
  code_incorrect_ou_expire:
    'Ce code est incorrect ou a expiré. Vérifiez les chiffres, ou demandez un nouveau code.',
  code_absent: 'Aucun code en attente. Demandez un nouveau code.',
  tentatives_epuisees:
    'Nombre maximal de tentatives atteint. Demandez un nouveau code.',
  trop_de_demandes:
    'Trop de codes demandés. Patientez une heure avant d’en demander un nouveau.',
  renvoi_trop_tot: 'Patientez avant de demander un nouveau code.',
  canal_indisponible:
    'Ce canal n’est pas encore disponible. Choisissez-en un autre.',
  deja_verifie: 'Cette coordonnée est déjà vérifiée.',
}
