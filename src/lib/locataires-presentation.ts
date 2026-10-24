/** Le bail conserve le locataire et son historique : il bloque sa suppression. */
export function peutSupprimerLocataire(nombreBaux: number): boolean {
  return nombreBaux === 0
}
