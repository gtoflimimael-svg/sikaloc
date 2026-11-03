const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/** Formate une date civile sans la convertir en instant ni changer de jour. */
export function formaterDateDocument(iso: string | null | undefined): string {
  if (!iso) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(iso)
  if (!match) return '—'

  const annee = Number(match[1])
  const mois = Number(match[2])
  const jour = Number(match[3])
  const validation = new Date(Date.UTC(annee, mois - 1, jour))
  if (
    validation.getUTCFullYear() !== annee ||
    validation.getUTCMonth() !== mois - 1 ||
    validation.getUTCDate() !== jour
  ) return '—'

  return `${jour === 1 ? '1er' : jour} ${MOIS[mois - 1]} ${annee}`
}

/** Formate un instant de génération dans le fuseau civil du Bénin. */
export function formaterHorodatageDocument(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const parties = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Porto-Novo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const valeur = (type: Intl.DateTimeFormatPartTypes) =>
    parties.find((partie) => partie.type === type)?.value ?? ''
  const jour = valeur('day')

  return `${jour === '1' ? '1er' : jour} ${valeur('month')} ${valeur('year')} à ${valeur('hour')}:${valeur('minute')}`
}
