'use client'

import Link from 'next/link'
import { CloudOff } from 'lucide-react'
import { EnteteEditorial } from '@/components/marketing/entete-editorial'
import styles from '@/components/marketing/editorial.module.css'

export default function ErreurFind({ retry }: { retry: () => void }) {
  return (
    <div className={styles.editorialPage}>
      <EnteteEditorial contexte="Find" action={{ href: '/', libelle: 'Accueil' }} />
      <main id="contenu" className={styles.stateMain}>
        <div className={styles.stateMark}><CloudOff size={24} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>Sikaloc Find</p>
        <h1>Recherche indisponible</h1>
        <p role="alert" className={styles.stateCopy}>Nous n’avons pas pu charger ces informations. Ce message ne signifie pas que le logement n’existe plus.</p>
        <div className={styles.stateActions}>
          <button type="button" onClick={retry} className="btn btn-primary">Réessayer</button>
          <Link href="/find" className="btn btn-secondary">Retour aux logements</Link>
        </div>
      </main>
    </div>
  )
}
