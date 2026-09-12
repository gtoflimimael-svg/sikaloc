import type { Echeance, EtatEcheance } from '@/lib/types/database'

/**
 * Les règles d'échéance, côté code.
 *
 * ─── Ce fichier ne recalcule rien ───────────────────────────────────────────
 *
 * L'état d'une échéance est décidé par la vue `v_echeances`, en base, et c'est
 * la seule décision qui compte. Ce module regroupe ce qu'il faut pour
 * *présenter* ces échéances et pour valider une déclaration avant de l'écrire :
 * il classe, il compte, il nomme. Il ne juge pas.
 *
 * La tentation inverse — réimplémenter la règle ici « pour éviter un aller-
 * retour » — produirait deux calculs qui finiraient par ne plus dire la même
 * chose, et c'est exactement ce que le cahier des charges interdit.
 *
 * ─── La distinction qui fonde tout ──────────────────────────────────────────
 *
 *     date_debut      quand le bail a commencé
 *     created_at      quand Sikaloc l'a appris
 *
 * Entre les deux, il a pu se passer huit mois de loyers encaissés. Sikaloc n'en
 * sait rien, et n'a pas le droit de supposer.
 */

export const LIBELLE_ETAT: Record<EtatEcheance, string> = {
  Réglé: 'Réglé',
  Impayé: 'Impayé',
  'À venir': 'À venir',
  'À déterminer': 'À déterminer',
}

/** Le ton d'affichage de chaque état, dans le vocabulaire du design system. */
export const TON_ETAT: Record<EtatEcheance, 'positif' | 'negatif' | 'neutre' | 'attention'> = {
  Réglé: 'positif',
  Impayé: 'negatif',
  'À venir': 'neutre',
  'À déterminer': 'attention',
}

/**
 * Les échéances sur lesquelles le bailleur doit se prononcer.
 *
 * Ce sont celles qui étaient déjà échues — au sens de la règle du bail, jour
 * d'échéance et tolérance comprises — au moment où le bail a été enregistré.
 * Pas « les mois écoulés » : un mois peut être presque terminé sans que son
 * loyer soit contractuellement exigible.
 *
 * Celles déjà réglées en sont exclues : un paiement enregistré est une réponse.
 */
export function echeancesADeclarer(echeances: Echeance[]): Echeance[] {
  return echeances
    .filter((e) => e.anterieure && e.etat !== 'Réglé')
    .sort((a, b) => a.periode_debut.localeCompare(b.periode_debut))
}

/** Y a-t-il quelque chose à demander au bailleur ? */
export function historiqueNecessaire(echeances: Echeance[]): boolean {
  return echeances.some((e) => e.etat === 'À déterminer')
}

/**
 * Les échéances antérieures déjà réglées, à rappeler dans le parcours.
 *
 * Elles ne sont pas à cocher — elles portent déjà un paiement — mais les taire
 * donnerait l'impression que Sikaloc les a oubliées.
 */
export function echeancesAnterieuresReglees(echeances: Echeance[]): Echeance[] {
  return echeances
    .filter((e) => e.anterieure && e.etat === 'Réglé')
    .sort((a, b) => a.periode_debut.localeCompare(b.periode_debut))
}

/**
 * Regroupement par année.
 *
 * Un bail commencé en 2020 et enregistré aujourd'hui apporte plus de
 * soixante-dix mois. Une liste plate de soixante-dix cases n'est pas
 * remplissable ; par année, elle le redevient.
 */
export function parAnnee(echeances: Echeance[]): { annee: string; mois: Echeance[] }[] {
  const groupes = new Map<string, Echeance[]>()

  for (const echeance of echeances) {
    const annee = echeance.periode_debut.slice(0, 4)
    const liste = groupes.get(annee)
    if (liste) liste.push(echeance)
    else groupes.set(annee, [echeance])
  }

  return [...groupes.entries()]
    .map(([annee, mois]) => ({ annee, mois }))
    .sort((a, b) => a.annee.localeCompare(b.annee))
}

/** Le total d'une liste d'échéances, pour le récapitulatif. */
export function totalDu(echeances: Echeance[]): number {
  return echeances.reduce((somme, e) => somme + Number(e.montant_du), 0)
}

export type MotifRefusHistorique =
  | 'bail_introuvable'
  | 'periode_inconnue'
  | 'periode_future'
  | 'deja_regle'
  | 'doublon'
  | 'rien_a_declarer'

export const MESSAGES_HISTORIQUE: Record<MotifRefusHistorique, string> = {
  bail_introuvable: 'Ce bail est introuvable.',
  periode_inconnue:
    'Un des mois sélectionnés n’appartient pas à la période de ce bail.',
  periode_future:
    'Un mois à venir ne peut pas être déclaré comme déjà réglé.',
  deja_regle: 'Un des mois sélectionnés porte déjà un paiement enregistré.',
  doublon: 'Le même mois a été envoyé deux fois.',
  rien_a_declarer: 'Ce bail n’a aucune échéance antérieure à renseigner.',
}
