import { Badge } from '@/components/ui/retours'
import type { EtatEcheance } from '@/lib/types/database'

/**
 * L'état d'un loyer, tel que le locataire le lit.
 *
 * ─── Le même mot des deux côtés ─────────────────────────────────────────────
 *
 * Les libellés sont ceux de l'espace bailleur, au caractère près. Adoucir
 * « Impayé » en « En attente » côté locataire produirait deux vocabulaires pour
 * un seul fait : le bailleur relancerait sur un impayé que son locataire aurait
 * lu comme une simple attente.
 *
 * ─── Le ton, en revanche, n'est pas le même ─────────────────────────────────
 *
 * « À déterminer » est affiché en attention plutôt qu'en négatif. Ce n'est pas
 * une dette : c'est un mois dont Sikaloc ne sait rien parce qu'il précède
 * l'arrivée du bailleur sur le produit. Le peindre en rouge accuserait quelqu'un
 * qui a probablement payé — en espèces, avant que ce logiciel n'existe pour lui.
 */
const TON: Record<EtatEcheance, 'positive' | 'warning' | 'negative' | 'neutral'> = {
  Réglé: 'positive',
  'À venir': 'neutral',
  Impayé: 'negative',
  'À déterminer': 'warning',
}

export function BadgeLoyer({ etat }: { etat: EtatEcheance }) {
  return <Badge ton={TON[etat]}>{etat}</Badge>
}
