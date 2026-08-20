import type { Bailleur, PlanAbonnement } from '@/lib/types/database'

/**
 * Limites des plans — spec §4.2.
 *
 * Plan Gratuit : jusqu'à 2 logements, quittances basiques sans mention de
 * timbre, pas de relances WhatsApp.
 */

export const LIMITE_LOGEMENTS_GRATUIT = 2

export const PRIX_STANDARD_FCFA = 5000

export interface CapacitesPlan {
  plan: PlanAbonnement
  /** Nombre maximum de logements, ou null si illimité. */
  maxLogements: number | null
  /** La mention du droit de timbre n'apparaît que sur les quittances Standard. */
  quittanceConforme: boolean
  /** Les relances WhatsApp d'impayés sont réservées au plan Standard. */
  relancesWhatsApp: boolean
}

/**
 * Un abonnement expiré retombe sur les capacités du plan Gratuit, sans que la
 * colonne `plan` soit modifiée : c'est la date de fin qui fait foi côté lecture,
 * ce qui évite d'avoir à faire tourner une tâche de rétrogradation.
 */
export function abonnementActif(bailleur: Pick<Bailleur, 'plan' | 'date_fin_abonnement'>): boolean {
  if (bailleur.plan !== 'Standard') return false
  if (!bailleur.date_fin_abonnement) return false

  return bailleur.date_fin_abonnement >= new Date().toISOString().slice(0, 10)
}

export function capacites(
  bailleur: Pick<Bailleur, 'plan' | 'date_fin_abonnement'>,
): CapacitesPlan {
  if (abonnementActif(bailleur)) {
    return {
      plan: 'Standard',
      maxLogements: null,
      quittanceConforme: true,
      relancesWhatsApp: true,
    }
  }

  return {
    plan: 'Gratuit',
    maxLogements: LIMITE_LOGEMENTS_GRATUIT,
    quittanceConforme: false,
    relancesWhatsApp: false,
  }
}

/**
 * Message affiché quand le plafond de logements est atteint.
 *
 * Le nombre déjà enregistré est rappelé : « limité à 2 logements » sans dire
 * qu'on en a déjà 2 se lit comme s'il en restait, et le bailleur repart en
 * boucle vers un formulaire qui va le refuser.
 */
export function messageLimiteLogements(enregistres?: number): string {
  const constat =
    enregistres === undefined
      ? `Le plan Gratuit est limité à ${LIMITE_LOGEMENTS_GRATUIT} logements.`
      : `Vos ${enregistres} logements sont enregistrés, et le plan Gratuit est ` +
        `limité à ${LIMITE_LOGEMENTS_GRATUIT}.`

  return (
    `${constat} Passez au plan Standard ` +
    `(${PRIX_STANDARD_FCFA.toLocaleString('fr-FR')} FCFA/mois) ` +
    'pour en enregistrer autant que vous le souhaitez.'
  )
}
