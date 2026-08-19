import type { StatutPaiement } from '@/lib/types/database'

/**
 * Fenêtre de correction d'un paiement validé — spec §6.1.7 : 5 minutes.
 *
 * Ces helpers sont purs et partagés client/serveur. Ils ne vivent pas dans
 * `actions/paiements.ts` : un module `'use server'` ne peut exporter que des
 * fonctions asynchrones, chacune devenant un endpoint réseau.
 *
 * La règle est également appliquée en base par le trigger
 * `proteger_paiement_fige` — ce qui suit ne sert qu'à l'affichage.
 */

export const FENETRE_CORRECTION_MS = 5 * 60_000

export function estCorrigeable(valideLe: string | null, statut: StatutPaiement): boolean {
  if (statut !== 'Validé') return true
  if (!valideLe) return true

  return Date.now() - new Date(valideLe).getTime() < FENETRE_CORRECTION_MS
}

/** Millisecondes restantes avant que le paiement ne soit figé. */
export function tempsRestantCorrection(valideLe: string | null): number {
  if (!valideLe) return FENETRE_CORRECTION_MS

  return Math.max(0, FENETRE_CORRECTION_MS - (Date.now() - new Date(valideLe).getTime()))
}
