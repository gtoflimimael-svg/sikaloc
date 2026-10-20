import type { TypeDocument, TypePaiement } from '@/lib/types/database'

/** Seul un loyer entièrement réglé peut produire une quittance de loyer. */
export function typeDocumentPaiement(
  typePaiement: TypePaiement,
  estPartiel: boolean,
): TypeDocument {
  return typePaiement === 'Loyer' && !estPartiel ? 'Quittance' : 'Reçu'
}
