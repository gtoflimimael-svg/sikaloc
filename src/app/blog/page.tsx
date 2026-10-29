import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { PiedDePage } from '@/components/marketing/pied-de-page'
import { EnteteEditorial } from '@/components/marketing/entete-editorial'
import styles from '@/components/marketing/editorial.module.css'
import { ARTICLES } from '@/lib/articles'

export const metadata: Metadata = {
  // Sans le suffixe : le gabarit de la racine (`%s · Sikaloc`) l'ajoute déjà.
  // C'était la seule page du site à le porter deux fois — « Le blog — Sikaloc
  // · Sikaloc » — parce qu'elle seule l'écrivait elle-même. Toutes les autres
  // pages simples (`/connexion`, `/inscription`, `/legal/*`) s'en tiennent à
  // un titre bref et laissent le gabarit faire son travail ; celle-ci s'aligne
  // sur cette convention plutôt que d'en inventer une nouvelle.
  title: 'Le blog',
  description:
    'Comment fonctionnent les quittances de loyer produites par Sikaloc : ce que le document contient, ce qu’il calcule, et comment il parvient à votre locataire.',
  alternates: { canonical: '/blog' },
}

/**
 * Index du blog.
 *
 * Cinq articles, et non les cinquante prescrits par l'Axe 3 : sur un site sans
 * historique, cinquante pages minces valent moins que cinq solides, et le
 * corpus proposé était du conseil juridique que les CGU excluent.
 */
export default function PageBlog() {
  return (
    <div className={styles.editorialPage}>
      <EnteteEditorial contexte="Ressources" action={{ href: '/inscription', libelle: 'Commencer' }} />

      <main id="contenu" className={styles.blogMain}>
        <header className={styles.intro}>
        <p className={styles.eyebrow}>Ressources · Comprendre Sikaloc</p>
        <h1>La location, plus lisible.</h1>
        <p>
          Ce que le document contient, ce qu&apos;il calcule, et comment il parvient
          à votre locataire. Tout ce qui est écrit ici se vérifie en ouvrant un
          document réel.
        </p>
        </header>

        <ol className={styles.articleList} aria-label="Articles Sikaloc">
          {ARTICLES.map((article, index) => (
            <li key={article.slug}>
              <Link href={`/blog/${article.slug}`} className={styles.articleLink} aria-labelledby={`article-${article.slug}`}>
                <span className={styles.articleNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h2 id={`article-${article.slug}`}>{article.titre}</h2>
                  <p>{article.resume}</p>
                </div>
                <ArrowUpRight size={22} className={styles.articleArrow} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>

        <p className={styles.disclaimer}>
          Ces articles décrivent le fonctionnement de Sikaloc. Ils ne constituent pas
          un conseil juridique et ne remplacent pas l&apos;avis d&apos;un professionnel
          du droit.
        </p>
      </main>

      <PiedDePage />
    </div>
  )
}
