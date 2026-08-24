import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PiedDePage } from '@/components/marketing/pied-de-page'
import { TexteRiche } from '@/components/marketing/texte-riche'
import { MarqueSikaloc } from '@/components/ui/logo'
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
    title: `${article.titre} — Sikaloc`,
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
    <>
      <header className="border-b border-hairline px-xl py-lg">
        <div className="mx-auto flex max-w-[46rem] items-center justify-between gap-lg">
          <Link href="/" aria-label="Sikaloc — accueil">
            <MarqueSikaloc taille="sm" />
          </Link>
          <Link href="/inscription" className="btn btn-primary btn-sm">
            Commencer
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[46rem] px-xl py-5xl">
        <Link href="/blog" className="text-body-sm font-semibold text-mute hover:text-ink">
          ← Tous les articles
        </Link>

        <h1 className="mt-lg text-display-lg font-extrabold tracking-tight text-ink">
          {article.titre}
        </h1>

        <div className="mt-xl rounded-lg border-l-2 border-primary bg-canvas p-lg">
          <p className="text-body-md text-body">
            <strong className="font-semibold text-ink">En bref.</strong> {article.enBref}
          </p>
        </div>

        <div className="mt-2xl space-y-lg">
          {article.blocs.map((bloc, i) => {
            if (bloc.type === 'titre') {
              return (
                <h2
                  key={i}
                  className="!mt-2xl text-display-sm font-bold text-ink"
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

        <section className="mt-3xl rounded-xl bg-canvas p-xl">
          <h2 className="text-title-lg font-bold text-ink">Voir le document par vous-même</h2>
          <p className="mt-sm text-body-md text-body">
            Une quittance réelle, avec des données fictives, sans créer de compte.
          </p>
          <div className="mt-lg flex flex-wrap gap-md">
            <Link href="/exemple-quittance" className="btn btn-primary">
              Voir une quittance
            </Link>
            <Link href="/exemple-recu" className="btn btn-secondary">
              Voir un reçu
            </Link>
          </div>
        </section>

        {autres.length > 0 ? (
          <section className="mt-3xl">
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
    </>
  )
}
