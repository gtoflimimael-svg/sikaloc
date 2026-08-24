import type { Metadata } from 'next'
import Link from 'next/link'

import { PiedDePage } from '@/components/marketing/pied-de-page'
import { MarqueSikaloc } from '@/components/ui/logo'
import { ARTICLES } from '@/lib/articles'

export const metadata: Metadata = {
  title: 'Le blog — Sikaloc',
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
    <>
      <header className="border-b border-hairline px-xl py-lg">
        <div className="mx-auto flex max-w-[56rem] items-center justify-between gap-lg">
          <Link href="/" aria-label="Sikaloc — accueil">
            <MarqueSikaloc taille="sm" />
          </Link>
          <Link href="/inscription" className="btn btn-primary btn-sm">
            Commencer
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[56rem] px-xl py-5xl">
        <p className="text-caption-uppercase uppercase text-primary">Le blog</p>
        <h1 className="mt-sm text-display-lg font-extrabold tracking-tight text-ink">
          Comment fonctionnent vos quittances
        </h1>
        <p className="mt-md max-w-[42rem] text-body-lg text-mute">
          Ce que le document contient, ce qu&apos;il calcule, et comment il parvient
          à votre locataire. Tout ce qui est écrit ici se vérifie en ouvrant un
          document réel.
        </p>

        <ul role="list" className="anim-cascade mt-3xl space-y-xl">
          {ARTICLES.map((article) => (
            <li key={article.slug} className="border-t border-hairline-strong pt-lg">
              <h2 className="text-display-sm font-bold text-ink">
                <Link href={`/blog/${article.slug}`} className="lien-anime">
                  {article.titre}
                </Link>
              </h2>
              <p className="mt-sm max-w-[42rem] text-body-md text-body">{article.resume}</p>
            </li>
          ))}
        </ul>

        <p className="mt-3xl text-body-sm text-mute">
          Ces articles décrivent le fonctionnement de Sikaloc. Ils ne constituent pas
          un conseil juridique et ne remplacent pas l&apos;avis d&apos;un professionnel
          du droit.
        </p>
      </main>

      <PiedDePage />
    </>
  )
}
