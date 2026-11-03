import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleCheck, Link2Off } from 'lucide-react'
import styles from '@/components/marketing/editorial.module.css'

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
  const Icone = retire ? CircleCheck : Link2Off

  return (
    <main id="contenu" className={styles.stateMain}>
      <div className={styles.stateMark}><Icone size={24} aria-hidden="true" /></div>
      <p className={styles.eyebrow}>Guide Sikaloc</p>

      <h1>
        {retire ? 'C’est fait, vous êtes désinscrit' : 'Ce lien n’est plus valable'}
      </h1>

      <p className={styles.stateCopy}>
        {retire
          ? 'Votre adresse ne recevra plus rien de notre part. Nous conservons la trace de ce retrait, précisément pour ne pas vous réinscrire par erreur.'
          : 'Il a peut-être déjà servi. Si vous recevez encore des messages, écrivez-nous et nous nous en occupons.'}
      </p>

      <div className={styles.stateActions}>
        <Link href="/" className="btn btn-secondary">
          Retour à l’accueil
        </Link>
      </div>
    </main>
  )
}
