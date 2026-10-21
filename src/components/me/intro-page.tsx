import type { ReactNode } from 'react'

/** Repère commun aux pages personnelles : sobre, distinct des pages marketing. */
export function IntroPageMe({ titre, description, icone }: { titre: string; description: string; icone: ReactNode }) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-hairline bg-canvas p-lg sm:p-xl">
      <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
      <div className="flex items-start gap-md">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-canvas-sage text-primary-deep" aria-hidden="true">{icone}</span>
        <div className="min-w-0">
          <p className="text-caption font-semibold uppercase tracking-[.12em] text-primary-deep">Sikaloc Me</p>
          <h1 className="mt-xxs page-title">{titre}</h1>
          <p className="mt-xs max-w-[55ch] text-body-md text-mute">{description}</p>
        </div>
      </div>
    </header>
  )
}
