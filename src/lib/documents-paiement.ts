import type { TypeDocument, TypePaiement } from '@/lib/types/database'

/** Seul un loyer entièrement réglé peut produire une quittance de loyer. */
export function typeDocumentPaiement(
  typePaiement: TypePaiement,
  estPartiel: boolean | null,
): TypeDocument {
  return typePaiement === 'Loyer' && estPartiel === false ? 'Quittance' : 'Reçu'
}

export type EtatPaiementFinance = 'Brouillon' | 'Partiel' | 'Payé' | 'À déterminer'

/** Le snapshot du document prévaut sur l'indicateur historique de la ligne. */
export function etatPaiementFinance({
  statut,
  typePaiement,
  estPartiel,
  finances,
}: {
  statut: string
  typePaiement: TypePaiement
  estPartiel: boolean | null
  finances?: unknown
}): EtatPaiementFinance {
  if (statut !== 'Validé') return 'Brouillon'
  if (typePaiement !== 'Loyer') return 'Payé'

  const snapshot = finances && typeof finances === 'object' && !Array.isArray(finances)
    ? finances as Record<string, unknown>
    : null
  const partiel = snapshot && Object.hasOwn(snapshot, 'est_partiel')
    ? snapshot.est_partiel
    : estPartiel

  if (typeof partiel !== 'boolean') return 'À déterminer'
  return partiel ? 'Partiel' : 'Payé'
}

export interface ApercuDocumentPaiement {
  cumul: number | null
  solde: number | null
  estPartiel: boolean | null
  typeDocument: TypeDocument | null
}

export interface FinancesDocumentApercu {
  montant?: number | null
  type_paiement?: TypePaiement | null
  loyer_mensuel?: number | null
}

export interface ApercuQuittanceFinance {
  typePaiement: TypePaiement
  montant: number
  /** NULL signifie que le loyer de référence n'est pas établi par les données. */
  loyerMensuel: number | null
}

/**
 * Prépare uniquement les valeurs d'affichage d'un document.
 * Un snapshot financier prévaut sur la ligne de paiement mutable ; à défaut,
 * le loyer courant n'est jamais présenté comme un montant historique établi.
 */
export function apercuQuittanceFinance({
  typePaiementPaiement,
  montantPaiement,
  finances,
}: {
  typePaiementPaiement: TypePaiement
  montantPaiement: number
  finances?: FinancesDocumentApercu | null
}): ApercuQuittanceFinance {
  const typePaiement = finances?.type_paiement ?? typePaiementPaiement
  const montantSnapshot = finances?.montant
  const montant =
    typeof montantSnapshot === 'number' && Number.isFinite(montantSnapshot)
      ? montantSnapshot
      : montantPaiement
  const loyerSnapshot = finances?.loyer_mensuel
  const loyerMensuel =
    typePaiement === 'Loyer' &&
    typeof loyerSnapshot === 'number' &&
    Number.isFinite(loyerSnapshot)
      ? loyerSnapshot
      : null

  return { typePaiement, montant, loyerMensuel }
}

/** Aperçu prudent : le calcul d'autorité du document reste effectué côté SQL. */
export function apercuDocumentPaiement({
  typePaiement,
  montant,
  loyerApplicable,
  cumulValideAvant,
}: {
  typePaiement: TypePaiement
  montant: number
  loyerApplicable: number | null
  cumulValideAvant: number | null
}): ApercuDocumentPaiement {
  if (typePaiement !== 'Loyer') {
    return { cumul: null, solde: null, estPartiel: null, typeDocument: 'Reçu' }
  }

  if (
    !Number.isFinite(montant) || montant <= 0 ||
    (loyerApplicable !== null && (!Number.isFinite(loyerApplicable) || loyerApplicable < 0)) ||
    (cumulValideAvant !== null && (!Number.isFinite(cumulValideAvant) || cumulValideAvant < 0))
  ) {
    return { cumul: null, solde: null, estPartiel: null, typeDocument: null }
  }

  // Un reçu peut attester le versement sans établir le montant contractuel dû.
  // Dans ce cas, il ne présente aucun solde et ne devient jamais une quittance.
  if (loyerApplicable === null || cumulValideAvant === null) {
    const cumul = cumulValideAvant === null ? null : cumulValideAvant + montant
    return { cumul, solde: null, estPartiel: null, typeDocument: 'Reçu' }
  }

  const cumul = cumulValideAvant + montant
  const solde = Math.max(0, loyerApplicable - cumul)
  const estPartiel = solde > 0
  return {
    cumul,
    solde,
    estPartiel,
    typeDocument: typeDocumentPaiement(typePaiement, estPartiel),
  }
}
