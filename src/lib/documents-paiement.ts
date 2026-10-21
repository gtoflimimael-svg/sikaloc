import type { TypeDocument, TypePaiement } from '@/lib/types/database'

/** Seul un loyer entièrement réglé peut produire une quittance de loyer. */
export function typeDocumentPaiement(
  typePaiement: TypePaiement,
  estPartiel: boolean,
): TypeDocument {
  return typePaiement === 'Loyer' && !estPartiel ? 'Quittance' : 'Reçu'
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

  if (loyerApplicable === null || cumulValideAvant === null) {
    return { cumul: null, solde: null, estPartiel: null, typeDocument: null }
  }

  if (
    !Number.isFinite(montant) || montant <= 0 ||
    !Number.isFinite(loyerApplicable) || loyerApplicable <= 0 ||
    !Number.isFinite(cumulValideAvant) || cumulValideAvant < 0
  ) {
    return { cumul: null, solde: null, estPartiel: null, typeDocument: null }
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
