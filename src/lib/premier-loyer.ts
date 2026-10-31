export type ConditionsPremierLoyer = {
  dateDebut: string
  montant: number | undefined
  exigibleLe: string | undefined
}

export type VerdictPremierLoyer =
  | { etat: 'indetermine' }
  | { etat: 'valide'; montant: number; exigibleLe: string }
  | { etat: 'incomplet' | 'montant_invalide' | 'date_invalide' | 'date_avant_debut' }

function dateCalendrierValide(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Valide une saisie explicite; ne calcule ni prorata ni montant contractuel. */
export function verifierConditionsPremierLoyer({
  dateDebut,
  montant,
  exigibleLe,
}: ConditionsPremierLoyer): VerdictPremierLoyer {
  if (montant === undefined && exigibleLe === undefined) return { etat: 'indetermine' }
  if (montant === undefined || exigibleLe === undefined) return { etat: 'incomplet' }
  if (!Number.isFinite(montant) || montant < 0) return { etat: 'montant_invalide' }
  if (!dateCalendrierValide(dateDebut) || !dateCalendrierValide(exigibleLe)) return { etat: 'date_invalide' }
  if (exigibleLe < dateDebut) return { etat: 'date_avant_debut' }
  return { etat: 'valide', montant, exigibleLe }
}
