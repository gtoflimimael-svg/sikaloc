import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleCheck, Link2Off, MailWarning } from 'lucide-react'
import styles from '@/components/marketing/editorial.module.css'

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
  const Icone = issue === 'jeton_invalide' ? Link2Off : issue === 'envoi_echoue' ? MailWarning : CircleCheck

  return (
    <main id="contenu" className={styles.stateMain}>
      <div className={styles.stateMark}><Icone size={24} aria-hidden="true" /></div>
      <p className={styles.eyebrow}>Guide Sikaloc</p>
      <h1>{titre}</h1>
      <p className={styles.stateCopy}>{texte}</p>

      <div className={styles.stateActions}>
        <Link href="/" className="btn btn-secondary">
          Retour à l’accueil
        </Link>
        <a href="/exemple-quittance" className="btn btn-primary">
          Voir un exemple de quittance
        </a>
      </div>
    </main>
  )
}
