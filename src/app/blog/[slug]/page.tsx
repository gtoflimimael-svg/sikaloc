import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PiedDePage } from '@/components/marketing/pied-de-page'
import { TexteRiche } from '@/components/marketing/texte-riche'
import { EnteteEditorial } from '@/components/marketing/entete-editorial'
import styles from '@/components/marketing/editorial.module.css'
import { ARTICLES, articleParSlug, avertissement } from '@/lib/articles'

/** Les cinq articles sont connus au build : rien à rendre à la demande. */
export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = articleParSlug(slug)
  if (!article) return {}

  return {
    // Sans le suffixe : le gabarit de la racine (`%s · Sikaloc`) l'ajoute
    // déjà. Même correction que `/blog` (voir son commentaire) — c'était la
    // même faute, sur chacun des cinq articles plutôt que sur un seul index.
    title: article.titre,
    description: article.resume,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.titre,
      description: article.resume,
      publishedTime: article.publieLe,
    },
  }
}

export default async function PageArticle({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const article = articleParSlug(slug)
  if (!article) notFound()

  const autres = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 2)

  return (
    <div className={styles.editorialPage}>
      <EnteteEditorial contexte="Ressources" action={{ href: '/inscription', libelle: 'Commencer' }} />

      <main id="contenu" className={styles.readingMain}>
        <Link href="/blog" className={styles.backLink}>
          ← Tous les articles
        </Link>

        <h1 className={styles.articleHeading}>
          {article.titre}
        </h1>

        <div className={styles.summary}>
          <p className="text-body-md text-body">
            <strong className="font-semibold text-ink">En bref.</strong> {article.enBref}
          </p>
        </div>

        <div className={styles.articleBody}>
          {article.blocs.map((bloc, i) => {
            if (bloc.type === 'titre') {
              return (
                <h2
                  key={i}
                >
                  {bloc.texte}
                </h2>
              )
            }

            if (bloc.type === 'citation') {
              return (
                <blockquote
                  key={i}
                  className="border-l-2 border-hairline-strong pl-lg text-body-md italic text-mute"
                >
                  {bloc.texte}
                </blockquote>
              )
            }

            if (bloc.type === 'liste') {
              return (
                <ul key={i} role="list" className="space-y-sm">
                  {bloc.items.map((item) => (
                    <li key={item} className="flex items-start gap-sm text-body-md text-body">
                      <span aria-hidden="true" className="mt-sm size-1.5 shrink-0 rounded-pill bg-primary" />
                      <span>
                        <TexteRiche>{item}</TexteRiche>
                      </span>
                    </li>
                  ))}
                </ul>
              )
            }

            return (
              <p key={i} className="text-body-lg leading-relaxed text-body">
                <TexteRiche>{bloc.texte}</TexteRiche>
              </p>
            )
          })}
        </div>

        <p className="mt-3xl border-t border-hairline pt-lg text-body-sm text-mute">
          {avertissement(article.slug)}
        </p>

        <section className={styles.documentCallout}>
          <h2 className="text-title-lg font-bold text-ink">Voir le document par vous-même</h2>
          <p className="mt-sm text-body-md text-body">
            Un exemple de quittance, avec des données fictives, sans créer de compte.
          </p>
          <div className="mt-lg flex flex-wrap gap-md">
            <a href="/exemple-quittance" className="btn btn-primary">
              Voir une quittance
            </a>
            <a href="/exemple-recu" className="btn btn-secondary">
              Voir un reçu
            </a>
          </div>
        </section>

        {autres.length > 0 ? (
          <section className={styles.related}>
            <h2 className="text-title-lg font-bold text-ink">À lire ensuite</h2>
            <ul role="list" className="mt-lg space-y-md">
              {autres.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/blog/${a.slug}`}
                    className="lien-anime text-body-md font-semibold text-ink"
                  >
                    {a.titre}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <PiedDePage />
    </div>
  )
}
