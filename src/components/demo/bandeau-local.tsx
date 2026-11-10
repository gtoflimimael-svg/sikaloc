import styles from './bandeau-local.module.css'

/** Repère visible uniquement dans le serveur local dédié à la démonstration. */
export function BandeauDemoLocal() {
  if (process.env.NODE_ENV !== 'development' || process.env.SIKALOC_DEMO_LOCAL !== '1') {
    return null
  }

  return (
    <aside className={styles.banner} role="status">
      Démonstration locale · comptes et données fictifs · aucun service de production
    </aside>
  )
}
