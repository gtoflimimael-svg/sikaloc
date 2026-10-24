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
