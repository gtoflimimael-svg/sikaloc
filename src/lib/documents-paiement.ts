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
