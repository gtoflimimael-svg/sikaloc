import Link from 'next/link'

import { MarqueSikaloc } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'
import styles from './editorial.module.css'

/** Repère commun aux contenus de lecture et aux confirmations publiques. */
export function EnteteEditorial({ contexte, action }: {
  contexte: string
  action: { href: string; libelle: string }
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand}>
          <MarqueSikaloc taille="sm" />
          <span>{contexte}</span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.theme}><SelecteurTheme compact /></div>
          <Link href={action.href} className="btn btn-secondary btn-sm">{action.libelle}</Link>
        </div>
      </div>
    </header>
  )
}
