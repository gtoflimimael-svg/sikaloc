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
      <div className="rounded-xl bg-primary p-xl text-on-primary">
        <p className="text-body-sm font-semibold opacity-90">{label}</p>
        <p className="mt-sm text-display-md font-extrabold tracking-tight tabular">{valeur}</p>
        {detail ? <p className="mt-xs text-caption opacity-90">{detail}</p> : null}
      </div>
    )
  }

  return (
    <div className="card">
      <p className="text-body-sm text-mute">{label}</p>
      <p
        className={`mt-sm text-display-md font-extrabold tracking-tight tabular ${
          ton === 'alerte' ? 'text-negative' : 'text-ink'
        }`}
      >
        {valeur}
      </p>
      {detail ? <p className="mt-xs text-caption text-mute">{detail}</p> : null}
    </div>
  )
}
