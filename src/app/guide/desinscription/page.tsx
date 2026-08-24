import type { Metadata } from 'next'
import Link from 'next/link'

import { desinscrire } from '@/lib/actions/guide'

export const metadata: Metadata = {
  title: 'Désinscription',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

/**
 * Désinscription en un clic, sans confirmation demandée.
 *
 * Faire cliquer une deuxième fois quelqu'un qui veut partir est une pratique
 * qu'on subit tous et que personne n'apprécie. Le retrait est immédiat ;
 * l'inscription, elle, exige une confirmation — l'asymétrie est voulue.
 */
export default async function PageDesinscription({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>
}) {
  const { jeton } = await searchParams
  const retire = await desinscrire(jeton ?? '')

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[36rem] flex-col justify-center px-xl py-5xl">
      <p className="text-caption-uppercase uppercase text-primary">Guide Sikaloc</p>

      <h1 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">
        {retire ? 'C’est fait, vous êtes désinscrit' : 'Ce lien n’est plus valable'}
      </h1>

      <p className="mt-lg text-body-lg text-body">
        {retire
          ? 'Votre adresse ne recevra plus rien de notre part. Nous conservons la trace de ce retrait, précisément pour ne pas vous réinscrire par erreur.'
          : 'Il a peut-être déjà servi. Si vous recevez encore des messages, écrivez-nous et nous nous en occupons.'}
      </p>

      <div className="mt-2xl">
        <Link href="/" className="btn btn-secondary">
          Retour à l’accueil
        </Link>
      </div>
    </main>
  )
}
