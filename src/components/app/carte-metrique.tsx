import type { ReactNode } from 'react'

/**
 * Stat card du tableau de bord.
 * Structure imposée par le design system : label en haut, valeur en display,
 * tendance en caption.
 */
export function CarteMetrique({
  label,
  valeur,
  detail,
  ton = 'neutre',
}: {
  label: string
  valeur: string
  detail?: ReactNode
  ton?: 'neutre' | 'primary' | 'alerte'
}) {
  if (ton === 'primary') {
    return (
      <div className="metric-card metric-card-primary">
        <p className="metric-label font-semibold">{label}</p>
        <p className="metric-value">{valeur}</p>
        {detail ? <p className="mt-xs text-caption opacity-90">{detail}</p> : null}
      </div>
    )
  }

  return (
    <div className={`metric-card ${ton === 'alerte' ? 'metric-card-alert' : ''}`}>
      <p className="metric-label">{label}</p>
      <p
        className={`metric-value ${
          ton === 'alerte' ? 'text-negative' : 'text-ink'
        }`}
      >
        {valeur}
      </p>
      {detail ? <p className="mt-xs text-caption text-mute">{detail}</p> : null}
    </div>
  )
}
