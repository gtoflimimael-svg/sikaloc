import type { ReactNode } from 'react'

/** Bandeau d'erreur ou de succès affiché en tête de formulaire. */
export function Alerte({
  ton,
  children,
}: {
  ton: 'erreur' | 'succes' | 'info' | 'attention'
  children: ReactNode
}) {
  const styles = {
    erreur: 'bg-negative/10 text-negative-darkest border-negative/30',
    succes: 'bg-positive-pale text-positive-deep border-positive/30',
    info: 'bg-canvas-sage text-ink-deep border-primary/20',
    attention: 'bg-warning-pale text-warning-content border-warning/30',
  }[ton]

  return (
    <div
      role={ton === 'erreur' ? 'alert' : 'status'}
      className={`rounded-lg border px-lg py-md text-body-sm font-semibold ${styles}`}
    >
      {children}
    </div>
  )
}

/** Badge de statut — vert validé, jaune en attente, rouge impayé. */
export function Badge({
  ton,
  children,
}: {
  ton: 'positive' | 'warning' | 'negative' | 'neutral'
  children: ReactNode
}) {
  return <span className={`badge badge-${ton}`}>{children}</span>
}

/** État vide — invite à créer la première entité plutôt que de constater un manque. */
export function EtatVide({
  icone,
  titre,
  description,
  action,
}: {
  icone?: ReactNode
  titre: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-canvas-soft px-xl py-4xl text-center">
      {icone ? <div className="mb-lg text-mute-soft">{icone}</div> : null}
      <p className="text-body-md font-semibold text-ink">{titre}</p>
      <p className="mx-auto mt-sm max-w-[28rem] text-body-md text-mute">{description}</p>
      {action ? <div className="mt-xl">{action}</div> : null}
    </div>
  )
}

/** Avatar circulaire à initiales — design system « Avatars locataires ». */
export function Avatar({
  initiales,
  taille = 40,
  ton = 'primary',
}: {
  initiales: string
  taille?: number
  ton?: 'primary' | 'neutre'
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: taille, height: taille, fontSize: taille * 0.36 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-pill font-semibold ${
        ton === 'primary' ? 'bg-primary text-on-primary' : 'bg-surface-elevated text-mute'
      }`}
    >
      {initiales}
    </span>
  )
}

/** Titre de page — display-md (32/800), le bon équilibre autorité/respiration. */
export function EnTetePage({
  titre,
  description,
  action,
}: {
  titre: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-xl flex flex-wrap items-start justify-between gap-lg">
      <div>
        <h1 className="text-display-md font-extrabold tracking-tight text-ink">{titre}</h1>
        {description ? (
          <p className="mt-xs max-w-[42rem] text-body-md text-mute">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
