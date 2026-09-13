import { Mail, MessageCircle, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { CarteAuth } from '@/components/auth/carte-auth'
import { ESPACE_ME } from '@/lib/roles'

export const metadata: Metadata = {
  title: 'Rejoindre Sikaloc_Me',
  description:
    'Votre bailleur vous invite à consulter votre logement, vos loyers et vos quittances.',
}

/**
 * Comment on entre dans Sikaloc_Me.
 *
 * ─── Pourquoi pas un formulaire d'inscription ───────────────────────────────
 *
 * Parce qu'un compte locataire créé tout seul ne serait relié à rien. Ce qui
 * rattache une personne à un logement, à un bail, à des quittances, c'est
 * l'invitation de son bailleur — elle seule sait de quel bail il s'agit.
 *
 * Un formulaire ouvert produirait des comptes vides que personne ne pourrait
 * relier ensuite sans risquer de rattacher la mauvaise personne au mauvais
 * bail. C'est un risque qu'on ne prend pas avec des documents de loyer.
 *
 * Cette page dit donc la vérité et donne le chemin : demandez l'invitation.
 */
export default function PageRejoindre() {
  return (
    <CarteAuth
      titre="Rejoindre Sikaloc_Me"
      description="Votre espace locataire s’ouvre sur invitation de votre bailleur."
      bas={
        <>
          Vous gérez des biens ?{' '}
          <Link href="/inscription" className="font-semibold text-ink underline">
            Créer un compte Sikaloc_Pro
          </Link>
        </>
      }
    >
      <div className="space-y-xl">
        <ol className="space-y-lg">
          <Etape
            numero={1}
            icone={<MessageCircle size={18} strokeWidth={2} aria-hidden="true" />}
            titre="Votre bailleur vous invite"
            texte="Il vous envoie un lien par WhatsApp ou par email, depuis votre fiche dans Sikaloc_Pro."
          />
          <Etape
            numero={2}
            icone={<ShieldCheck size={18} strokeWidth={2} aria-hidden="true" />}
            titre="Vous confirmez que c’est bien vous"
            texte="Un code vous est envoyé. Il vérifie votre adresse et votre numéro avant tout accès."
          />
          <Etape
            numero={3}
            icone={<Mail size={18} strokeWidth={2} aria-hidden="true" />}
            titre="Vous retrouvez votre logement"
            texte="Votre bail, vos loyers et vos quittances vous attendent — ce sont les mêmes documents que ceux de votre bailleur, pas des copies."
          />
        </ol>

        <div className="rounded-md border border-hairline bg-canvas-soft p-lg">
          <p className="text-body-sm text-body">
            <strong className="text-ink">Vous avez déjà reçu une invitation ?</strong>{' '}
            Ouvrez le lien qu’elle contient : c’est lui qui vous rattache à votre
            bail.
          </p>
          <p className="mt-sm text-body-sm text-mute">
            Vous avez déjà un compte ?{' '}
            <Link href="/connexion" className="font-semibold text-ink underline">
              Se connecter
            </Link>
          </p>
        </div>

        <p className="text-caption text-mute">
          Sikaloc ne crée jamais de compte locataire sans invitation : c’est elle
          qui relie une personne à un logement. Sans elle, {ESPACE_ME.nom}{' '}
          n’aurait rien à vous montrer.
        </p>
      </div>
    </CarteAuth>
  )
}

function Etape({
  numero,
  icone,
  titre,
  texte,
}: {
  numero: number
  icone: React.ReactNode
  titre: string
  texte: string
}) {
  return (
    <li className="flex gap-md">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-canvas-sage text-primary"
      >
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-body-md font-semibold text-ink">
          <span className="sr-only">Étape {numero} — </span>
          {titre}
        </p>
        <p className="mt-xxs text-body-sm text-mute">{texte}</p>
      </div>
    </li>
  )
}
