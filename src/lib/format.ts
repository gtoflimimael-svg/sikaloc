/**
 * Formatage — montants FCFA, dates et périodes.
 *
 * Le franc CFA n'a pas de sous-unité : aucun montant n'est affiché avec des
 * décimales. Le séparateur de milliers est un espace insécable, comme le veut
 * la convention francophone.
 */

// U+00A0 (espace insécable) et non U+202F (espace fine insécable) : cette
// dernière est absente de l'encodage WinAnsi des polices standard du PDF et
// s'y afficherait comme un glyphe parasite au milieu de chaque montant.
const ESPACE_INSECABLE = ' '

/** « 150 000 FCFA » */
export function formaterFCFA(montant: number | string | null | undefined): string {
  const valeur = Number(montant ?? 0)
  if (!Number.isFinite(valeur)) return `0${ESPACE_INSECABLE}FCFA`

  return `${formaterNombre(valeur)}${ESPACE_INSECABLE}FCFA`
}

/** « 150 000 » — sans unité, pour les cellules de tableau déjà légendées. */
export function formaterNombre(montant: number | string | null | undefined): string {
  const valeur = Number(montant ?? 0)
  if (!Number.isFinite(valeur)) return '0'

  return Math.round(valeur)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_INSECABLE)
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/**
 * Découpe une date ISO `YYYY-MM-DD` sans passer par `new Date()`.
 *
 * `new Date('2026-08-17')` est interprété en UTC puis réaffiché dans le fuseau
 * local : à l'ouest de Greenwich, la date recule d'un jour. Les dates métier de
 * Sikaloc (échéance, période de loyer) sont des dates civiles, pas des instants.
 */
function decouperDateISO(iso: string): { annee: number; mois: number; jour: number } | null {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!correspondance) return null

  return {
    annee: Number(correspondance[1]),
    mois: Number(correspondance[2]),
    jour: Number(correspondance[3]),
  }
}

/** « 17 août 2026 » */
export function formaterDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = decouperDateISO(iso)
  if (!d) return '—'

  return `${d.jour} ${MOIS[d.mois - 1]} ${d.annee}`
}

/** « 17/08/2026 » — pour les colonnes de tableau denses. */
export function formaterDateCourte(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = decouperDateISO(iso)
  if (!d) return '—'

  return `${String(d.jour).padStart(2, '0')}/${String(d.mois).padStart(2, '0')}/${d.annee}`
}

/** « août 2026 » — libellé d'une période de loyer. */
export function formaterPeriode(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = decouperDateISO(iso)
  if (!d) return '—'

  return `${MOIS[d.mois - 1]} ${d.annee}`
}

/** « 17 août 2026 à 14:32 » — horodatage de génération d'une quittance. */
export function formaterHorodatage(iso: string | null | undefined): string {
  if (!iso) return '—'

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const heures = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${date.getDate()} ${MOIS[date.getMonth()]} ${date.getFullYear()} à ${heures}:${minutes}`
}

/** Date du jour au format `YYYY-MM-DD`, dans le fuseau local. */
export function aujourdhuiISO(): string {
  const maintenant = new Date()
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  const jour = String(maintenant.getDate()).padStart(2, '0')

  return `${maintenant.getFullYear()}-${mois}-${jour}`
}

/** Premier jour du mois d'une date ISO. */
export function debutDeMois(iso: string): string {
  const d = decouperDateISO(iso)
  if (!d) return iso

  return `${d.annee}-${String(d.mois).padStart(2, '0')}-01`
}

/** Dernier jour du mois d'une date ISO. */
export function finDeMois(iso: string): string {
  const d = decouperDateISO(iso)
  if (!d) return iso

  // Le jour 0 du mois suivant est le dernier jour du mois courant.
  const dernier = new Date(Date.UTC(d.annee, d.mois, 0)).getUTCDate()

  return `${d.annee}-${String(d.mois).padStart(2, '0')}-${String(dernier).padStart(2, '0')}`
}

/** Liste de périodes mensuelles récentes, pour le sélecteur de paiement. */
export function periodesRecentes(nbMois = 18): { valeur: string; libelle: string }[] {
  const maintenant = new Date()
  const periodes: { valeur: string; libelle: string }[] = []

  // On propose un mois d'avance : un loyer peut être réglé avant son échéance.
  for (let decalage = 1; decalage >= -(nbMois - 2); decalage--) {
    const date = new Date(maintenant.getFullYear(), maintenant.getMonth() + decalage, 1)
    const valeur = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    periodes.push({ valeur, libelle: `${MOIS[date.getMonth()]} ${date.getFullYear()}` })
  }

  return periodes
}

/** Initiales pour l'avatar d'un locataire. */
export function initiales(nom: string): string {
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join('')
}
