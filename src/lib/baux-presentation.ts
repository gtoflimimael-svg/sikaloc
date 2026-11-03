import type { StatutBail } from '@/lib/types/database'

/**
 * Une erreur de lecture n'est jamais interprétée comme une absence de paiement.
 * La suppression du bail n'est proposée que si l'historique a été vérifié.
 */
export function peutSupprimerBail(
  nombrePaiements: number,
  historiqueVerifie: boolean,
): boolean {
  return historiqueVerifie && nombrePaiements === 0
}

/** Seuls les statuts réellement définis par le modèle peuvent filtrer la liste. */
export function normaliserFiltreBail(valeur: string | undefined): StatutBail | null {
  return valeur === 'Actif' || valeur === 'Résilié' ? valeur : null
}

const MOIS_ABREGES = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]

/** « 24 oct. 2026 » — une date civile, sans conversion de fuseau horaire. */
export function formaterDateBail(iso: string | null | undefined): string | null {
  if (!iso) return null

  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!correspondance) return null

  const annee = Number(correspondance[1])
  const mois = Number(correspondance[2])
  const jour = Number(correspondance[3])
  if (mois < 1 || mois > 12 || jour < 1) return null

  const anneeBissextile = annee % 4 === 0 && (annee % 100 !== 0 || annee % 400 === 0)
  const joursDansMois = [31, anneeBissextile ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (jour > joursDansMois[mois - 1]) return null

  return `${jour === 1 ? '1er' : jour} ${MOIS_ABREGES[mois - 1]} ${annee}`
}
