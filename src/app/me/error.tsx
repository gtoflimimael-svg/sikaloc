'use client'

import Link from 'next/link'
import { CloudOff } from 'lucide-react'
import { EnteteEditorial } from '@/components/marketing/entete-editorial'
import styles from '@/components/marketing/editorial.module.css'

export default function ErreurMe({ retry }: { retry: () => void }) {
  return (
    <div className={styles.editorialPage}>
      <EnteteEditorial contexte="Me" action={{ href: '/', libelle: 'Accueil' }} />
      <main id="contenu" className={styles.stateMain}>
        <div className={styles.stateMark}><CloudOff size={24} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>Sikaloc Me</p>
        <h1>Informations indisponibles</h1>
        <p role="alert" className={styles.stateCopy}>Vos informations n’ont pas pu être chargées. Aucun solde ni état de paiement ne peut être confirmé pour le moment.</p>
        <div className={styles.stateActions}>
          <button type="button" onClick={retry} className="btn btn-primary">Réessayer</button>
          <Link href="/me" className="btn btn-secondary">Retour à mon espace</Link>
        </div>
      </main>
    </div>
  )
}
