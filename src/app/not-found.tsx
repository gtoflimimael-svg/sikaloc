import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

import { EnteteEditorial } from '@/components/marketing/entete-editorial'
import styles from '@/components/marketing/editorial.module.css'

export default function PageIntrouvable() {
  return <div className={styles.editorialPage}>
    <EnteteEditorial contexte="Sikaloc" action={{ href: '/', libelle: 'Accueil' }} />
    <main id="contenu" className={styles.stateMain}>
      <div className={styles.stateMark}><FileQuestion size={24} aria-hidden="true" /></div>
      <p className={styles.eyebrow}>Page introuvable · 404</p>
      <h1>Cette page n’est pas disponible.</h1>
      <p className={styles.stateCopy}>L’adresse a peut-être changé ou le lien est incomplet. Vous pouvez retrouver les espaces Sikaloc depuis l’accueil.</p>
      <div className={styles.stateActions}>
        <Link href="/" className="btn btn-primary">Retour à l’accueil</Link>
        <Link href="/find" className="btn btn-secondary">Chercher un logement</Link>
      </div>
    </main>
  </div>
}
