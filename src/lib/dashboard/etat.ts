/**
 * États de présentation du tableau de bord Pro, déterminés uniquement par les
 * enregistrements métier déjà présents.
 */
export type EtatDashboardPro = 'demarrage' | 'intermediaire' | 'operationnel'
export type ActionPrincipaleDemarrage = 'logement' | 'find' | 'bail'

export function determinerEtatDashboardPro(
  nbLogements: number,
  nbBaux: number,
): EtatDashboardPro {
  if (nbBaux > 0) return 'operationnel'
  if (nbLogements > 0) return 'intermediaire'
  return 'demarrage'
}

/** Chaque jalon est terminé par l'existence de son enregistrement, pas par un clic. */
export function compterEtapesConfigurees({
  nbLogements,
  nbLocataires,
  nbBaux,
}: {
  nbLogements: number
  nbLocataires: number
  nbBaux: number
}): number {
  return [nbLogements > 0, nbLocataires > 0, nbBaux > 0].filter(Boolean).length
}

/** Une fiche locataire n'est pas obligatoire pour proposer un logement vacant. */
export function determinerActionPrincipaleDemarrage({
  nbLogements,
  nbLocataires,
}: {
  nbLogements: number
  nbLocataires: number
}): ActionPrincipaleDemarrage {
  if (nbLogements === 0) return 'logement'
  if (nbLocataires === 0) return 'find'
  return 'bail'
}

/** Le formulaire de bail ne peut être proposé qu'avec ses deux entités réelles. */
export function peutCreerBail({
  nbLogementsLibres,
  nbLocataires,
}: {
  nbLogementsLibres: number
  nbLocataires: number
}): boolean {
  return nbLogementsLibres > 0 && nbLocataires > 0
}
