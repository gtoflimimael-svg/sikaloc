import type { EquipementAnnonce, MotifClotureAnnonce, StatutAnnonce } from '@/lib/types/database'

/**
 * Ce que le bailleur lit à la place des valeurs de la base.
 *
 * Les valeurs (`publiee`, `cour_cloturee`…) sont des clés : stables, sans
 * accent, faites pour les requêtes. Rien de ce qui s'affiche n'en dérive par
 * transformation automatique — une majuscule posée sur `wc_interieur` ne fait
 * pas une phrase.
 */

export const LIBELLES_STATUT: Record<StatutAnnonce, string> = {
  brouillon: 'Brouillon',
  publiee: 'Publiée',
  suspendue: 'Suspendue',
  cloturee: 'Clôturée',
}

export const TON_STATUT: Record<StatutAnnonce, 'positive' | 'warning' | 'negative' | 'neutral'> = {
  brouillon: 'neutral',
  publiee: 'positive',
  suspendue: 'warning',
  cloturee: 'neutral',
}

export const LIBELLES_MOTIF: Record<MotifClotureAnnonce, string> = {
  louee_sikaloc: 'Louée via Sikaloc',
  louee_ailleurs: 'Louée',
  retiree: 'Retirée',
}

export const LIBELLES_EQUIPEMENT: Record<EquipementAnnonce, string> = {
  eau_courante: 'Eau courante',
  electricite: 'Électricité',
  compteur_eau_individuel: 'Compteur d’eau individuel',
  compteur_electrique_individuel: 'Compteur électrique individuel',
  douche_interieure: 'Douche intérieure',
  wc_interieur: 'WC intérieur',
  cuisine_interieure: 'Cuisine intérieure',
  cour_cloturee: 'Cour clôturée',
  gardien: 'Gardien',
  parking: 'Parking',
  climatisation: 'Climatisation',
}

/** « 2 chambres salon », « Entrer-coucher » — la façon dont on parle d'un logement à Cotonou. */
export function libelleChambres(chambres: number | null): string | null {
  if (chambres === null) return null
  if (chambres === 0) return 'Entrer-coucher'
  return `${chambres} chambre${chambres > 1 ? 's' : ''} salon`
}
