import type { ReactNode } from 'react'
import styles from './espace.module.css'

/** Repère commun aux pages personnelles : sobre, distinct des pages marketing. */
export function IntroPageMe({ titre, description, icone }: { titre: string; description: string; icone: ReactNode }) {
  return (
    <header className={styles.intro}>
        <span className={styles.introIcon} aria-hidden="true">{icone}</span>
        <div className="min-w-0">
          <p className={styles.introKicker}>Sikaloc Me · Votre location</p>
          <h1 className="mt-xxs page-title">{titre}</h1>
          <p className="mt-xs max-w-[55ch] text-body-md text-mute">{description}</p>
        </div>
    </header>
  )
}
