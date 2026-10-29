import { PiedDePage } from '@/components/marketing/pied-de-page'
import { EnteteEditorial } from '@/components/marketing/entete-editorial'
import { NavigationLegale } from '@/components/marketing/navigation-legale'
import styles from '@/components/marketing/editorial.module.css'
import { mentionsCompletes } from '@/lib/mentions-legales'

export default function LayoutLegal({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <EnteteEditorial contexte="Documents juridiques" action={{ href: '/', libelle: 'Accueil' }} />

      <main id="contenu" className={styles.legalMain}>
        <NavigationLegale mentions={mentionsCompletes()} />
        <article className={styles.legalArticle}>{children}</article>
      </main>

      <PiedDePage />
    </div>
  )
}
