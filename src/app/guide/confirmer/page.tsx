import type { Metadata } from 'next'
import Link from 'next/link'

import { confirmerEtEnvoyer } from '@/lib/actions/guide'

export const metadata: Metadata = {
  title: 'Confirmation de votre adresse',
  // Cette page ne s'atteint que par un lien reçu par email et porte un jeton
  // dans son adresse : elle n'a rien à faire dans un index.
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

const MESSAGES = {
  confirme: {
    titre: 'C’est confirmé — le guide est parti',
    texte:
      'Vous devriez le recevoir dans quelques instants, en pièce jointe. S’il n’arrive pas, regardez dans vos courriers indésirables.',
  },
  deja_confirme: {
    titre: 'Le guide vous a été renvoyé',
    texte:
      'Cette adresse était déjà confirmée. Nous vous avons renvoyé le guide, au cas où le premier message se serait perdu.',
  },
  jeton_invalide: {
    titre: 'Ce lien n’est plus valable',
    texte:
      'Il a peut-être déjà servi, ou une demande plus récente l’a remplacé. Redemandez le guide depuis la page d’accueil : vous recevrez un nouveau lien.',
  },
  envoi_echoue: {
    titre: 'L’envoi n’a pas abouti',
    texte:
      'Votre adresse est bien enregistrée, mais le message n’a pas pu partir. Réessayez dans quelques minutes en redemandant le guide.',
  },
} as const

export default async function PageConfirmation({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>
}) {
  const { jeton } = await searchParams
  const issue = await confirmerEtEnvoyer(jeton ?? '')
  const { titre, texte } = MESSAGES[issue]

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[36rem] flex-col justify-center px-xl py-5xl">
      <p className="text-caption-uppercase uppercase text-primary">Guide Sikaloc</p>
      <h1 className="mt-sm text-display-md font-extrabold tracking-tight text-ink">{titre}</h1>
      <p className="mt-lg text-body-lg text-body">{texte}</p>

      <div className="mt-2xl flex flex-wrap gap-md">
        <Link href="/" className="btn btn-secondary">
          Retour à l’accueil
        </Link>
        <Link href="/exemple-quittance" className="btn btn-primary">
          Voir une vraie quittance
        </Link>
      </div>
    </main>
  )
}
