/**
 * États de présentation du tableau de bord Pro, déterminés uniquement par les
 * enregistrements métier déjà présents.
 */
export type EtatDashboardPro = 'demarrage' | 'intermediaire' | 'operationnel'
export type ActionPrincipaleDemarrage = 'logement' | 'find' | 'bail'
export type ActionContextuelleDashboard =
  | 'enregistrer-paiement'
  | 'creer-bail'
  | 'preparer-annonce'
  | 'aucune'

export type RecouvrementDashboard = {
  attendu: number
  valide: number
  taux: number | null
  progression: number | null
  reste: number
  excedent: number
}

/**
 * Prépare l'affichage des métriques déjà calculées par la vue métier.
 * Aucun montant n'est recalculé depuis les paiements côté interface.
 */
export function presenterRecouvrementDashboard(
  attenduSource: number | string | null | undefined,
  valideSource: number | string | null | undefined,
): RecouvrementDashboard | null {
  if (attenduSource == null || valideSource == null || attenduSource === '' || valideSource === '') return null

  const attendu = Number(attenduSource)
  const valide = Number(valideSource)
  if (!Number.isFinite(attendu) || !Number.isFinite(valide) || attendu < 0 || valide < 0) return null

  const taux = attendu > 0 ? Math.round((valide / attendu) * 100) : null
  return {
    attendu,
    valide,
    taux,
    progression: taux === null ? null : Math.max(0, Math.min(taux, 100)),
    reste: Math.max(0, attendu - valide),
    excedent: Math.max(0, valide - attendu),
  }
}

/**
 * La vue mensuelle utilise `current_date` dans PostgreSQL (UTC par défaut).
 * Son libellé doit suivre le même mois, notamment à la frontière de fuseau.
 */
export function periodeCouranteDashboard(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

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

/**
 * Propose une seule prochaine action à partir de situations déjà établies.
 * Les retards et brouillons sont traités dans la file « À surveiller » ; cette
 * fonction ne transforme jamais un manque de recouvrement en impayé.
 */
export function determinerActionContextuelleDashboard({
  nbBauxActifs,
  nbLogementsLibres,
  nbLocataires,
  loyerAttendu,
  loyerPercu,
  logementLibreSansAnnonce,
  suiviUrgentConnu = true,
  nbImpayes = 0,
  nbBrouillons = 0,
}: {
  nbBauxActifs: number
  nbLogementsLibres: number
  nbLocataires: number
  loyerAttendu: number
  loyerPercu: number
  logementLibreSansAnnonce: boolean
  suiviUrgentConnu?: boolean
  nbImpayes?: number
  nbBrouillons?: number
}): ActionContextuelleDashboard {
  // Ne pas proposer un nouvel enregistrement tant qu'un versement attend déjà
  // confirmation, qu'un retard requiert le suivi, ou que ces données manquent.
  if (!suiviUrgentConnu || nbImpayes > 0 || nbBrouillons > 0) return 'aucune'
  if (nbBauxActifs > 0 && loyerAttendu > loyerPercu) return 'enregistrer-paiement'
  if (peutCreerBail({ nbLogementsLibres, nbLocataires })) return 'creer-bail'
  if (nbLogementsLibres > 0 && logementLibreSansAnnonce) return 'preparer-annonce'
  return 'aucune'
}
