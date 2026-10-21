import type { Metadata } from 'next'
import Link from 'next/link'

import { PiedDePage } from '@/components/marketing/pied-de-page'
import { MarqueSikaloc } from '@/components/ui/logo'
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
    <>
      <header className="border-b border-hairline px-xl py-lg">
        <div className="mx-auto flex max-w-[56rem] items-center justify-between gap-lg">
          <MarqueSikaloc taille="sm" />
          <Link href="/inscription" className="btn btn-primary btn-sm">
            Commencer
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-xl py-5xl">
        <p className="text-caption-uppercase uppercase text-primary">Ressources</p>
        <h1 className="mt-sm max-w-[48rem] text-display-lg font-extrabold tracking-tight text-ink">Le blog Sikaloc</h1>
        <p className="mt-md max-w-[42rem] text-body-lg text-mute">
          Ce que le document contient, ce qu&apos;il calcule, et comment il parvient
          à votre locataire. Tout ce qui est écrit ici se vérifie en ouvrant un
          document réel.
        </p>

        <ul role="list" className="anim-cascade mt-3xl grid gap-lg md:grid-cols-2">
          {ARTICLES.map((article) => (
            <li key={article.slug} className="blog-article-card card card-lg flex flex-col border border-hairline">
              <p className="mb-md text-caption font-semibold uppercase tracking-wide text-ink-deep">Comprendre Sikaloc</p>
              <h2 className="text-display-sm font-bold text-ink">
                <Link href={`/blog/${article.slug}`} className="lien-anime">
                  {article.titre}
                </Link>
              </h2>
              <p className="mt-sm flex-1 text-body-md text-body">{article.resume}</p>
              <Link href={`/blog/${article.slug}`} className="mt-lg inline-flex text-body-sm font-semibold text-ink underline underline-offset-4">Lire l’article →</Link>
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
