import Link from 'next/link'
import { House } from 'lucide-react'
import { EnteteEditorial } from '@/components/marketing/entete-editorial'
import styles from '@/components/marketing/editorial.module.css'

/**
 * La réponse unique de `/find/[reference]` à tout ce qui n'est pas une annonce
 * publiée : référence inconnue, mal formée, annonce en brouillon, suspendue,
 * clôturée ou supprimée.
 *
 * Elle ne dit pas laquelle — elle ne le sait pas, et un visiteur n'a pas à
 * apprendre qu'une annonce existe mais n'est plus visible. Aucune donnée n'y
 * est lue : pas même la référence demandée.
 */
export default function AnnonceIntrouvable() {
  return (
    <div className={styles.editorialPage}>
      <EnteteEditorial contexte="Find" action={{ href: "/find", libelle: "Les logements" }} />
      <main id="contenu" className={styles.stateMain}>
        <div className={styles.stateMark}><House size={24} aria-hidden="true" /></div>
        <p className={styles.eyebrow}>Sikaloc Find</p>
        <h1 >Cette annonce n’est pas disponible</h1>
        <p className={styles.stateCopy}>
          Elle n’existe pas, ou elle n’est plus proposée à la location.
        </p>
        <div className={styles.stateActions}><Link href="/find" className="btn btn-primary">
          Voir les logements disponibles
        </Link></div>
      </main>
    </div>
  )
}
