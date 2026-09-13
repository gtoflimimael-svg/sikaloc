import { ArrowRight, Building2, Home } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MarqueSikaloc } from '@/components/ui/logo'
import { ESPACE_ME, ESPACE_PRO, type Espace } from '@/lib/roles'
import { rolesDuCompte } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = {
  title: 'Entrer dans Sikaloc',
  description:
    'Sikaloc_Pro pour les propriétaires et bailleurs, Sikaloc_Me pour les locataires.',
}

/**
 * « Continuer en tant que » — la porte d'entrée de l'écosystème.
 *
 * ─── Pourquoi ici et pas sur `/` ────────────────────────────────────────────
 *
 * `/` est la page marketing : un millier de lignes, le blog, le plan de site,
 * le référencement. La remplacer par deux boutons aurait supprimé le canal
 * d'acquisition pour résoudre un problème de navigation. Le choix vit donc là
 * où il sert — au moment où quelqu'un vient se connecter ou créer un compte.
 *
 * ─── Ce que cette page fait selon qui l'ouvre ───────────────────────────────
 *
 *   visiteur           les deux espaces, à choisir
 *   bailleur seul      envoyé directement vers Sikaloc_Pro
 *   locataire seul     envoyé directement vers Sikaloc_Me
 *   les deux rôles     la question est posée, parce qu'elle a un sens
 *
 * Le dernier cas n'est pas un cas limite : quelqu'un qui possède un logement
 * et en loue un autre a les deux rôles. Deviner l'enverrait une fois sur deux
 * au mauvais endroit.
 */
export default async function PageEntrer({
  searchParams,
}: {
  searchParams: Promise<{ choix?: string }>
}) {
  const { choix } = await searchParams
  const supabase = await creerClientServeur()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // `?choix=1` : on arrive depuis un bouton « changer d'espace ». La question
  // est alors posée même quand un seul rôle répondrait — sinon le bouton ne
  // ferait rien de visible.
  if (user && choix !== '1') {
    const roles = await rolesDuCompte()
    if (roles.estBailleur && !roles.estLocataire) redirect(ESPACE_PRO.racine)
    if (roles.estLocataire && !roles.estBailleur) redirect(ESPACE_ME.racine)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas-soft px-lg py-3xl">
      <div className="w-full max-w-[860px]">
        <div className="mb-2xl flex flex-col items-center text-center anim-apparait">
          <MarqueSikaloc />
          <h1 className="mt-xl text-display-md font-extrabold tracking-tight text-ink">
            Continuer en tant que
          </h1>
          <p className="mt-sm max-w-[520px] text-body-md text-mute">
            Sikaloc réunit deux espaces : celui qui loue un bien, et celui qui
            l&apos;habite. Les deux partagent les mêmes documents.
          </p>
        </div>

        {/*
          Une colonne sur téléphone, deux à partir de la tablette. Les cartes
          sont des liens entiers : sur mobile, viser un petit bouton à
          l'intérieur d'une carte est le meilleur moyen de rater sa cible.
        */}
        <div className="grid gap-lg md:grid-cols-2">
          <CarteEspace
            espace={ESPACE_PRO}
            icone={<Building2 size={26} strokeWidth={1.75} aria-hidden="true" />}
            destination={user ? ESPACE_PRO.racine : '/connexion'}
            secondaire={user ? null : { libelle: 'Créer un compte', href: '/inscription' }}
          />

          <CarteEspace
            espace={ESPACE_ME}
            icone={<Home size={26} strokeWidth={1.75} aria-hidden="true" />}
            destination={user ? ESPACE_ME.racine : '/me/rejoindre'}
            secondaire={null}
            /*
              Un locataire ne crée pas un compte de lui-même : il en reçoit
              l'invitation de son bailleur, parce que c'est cette invitation
              qui le rattache à un bail. Un compte créé sans elle ne serait
              relié à rien, et n'afficherait rien.
            */
            mention={
              user ? undefined : 'Votre bailleur vous envoie une invitation pour commencer.'
            }
          />
        </div>

        <p className="mt-2xl text-center text-body-sm text-mute">
          <Link href="/" className="underline hover:text-ink">
            ← Retour à l&apos;accueil
          </Link>
        </p>
      </div>
    </main>
  )
}

function CarteEspace({
  espace,
  icone,
  destination,
  secondaire,
  mention,
}: {
  espace: Espace
  icone: React.ReactNode
  destination: string
  secondaire: { libelle: string; href: string } | null
  mention?: string
}) {
  return (
    <div
      className="card card-lg flex flex-col anim-monte transition-shadow hover:shadow-lg"
      style={{ animationDelay: '80ms' }}
    >
      <Link href={destination} className="group flex-1">
        <span className="flex size-12 items-center justify-center rounded-md bg-canvas-sage text-primary">
          {icone}
        </span>

        <p className="mt-lg text-caption font-semibold uppercase tracking-wide text-primary">
          {espace.nom}
        </p>
        <h2 className="mt-xxs text-title-lg font-bold tracking-tight text-ink">
          {espace.titre}
        </h2>
        <p className="mt-xs text-body-md text-mute">{espace.description}</p>

        <ul className="mt-lg space-y-xs">
          {espace.actions.map((action) => (
            <li key={action} className="flex items-start gap-sm text-body-sm text-body">
              <span
                aria-hidden="true"
                className="mt-[0.45rem] size-1.5 shrink-0 rounded-pill bg-primary"
              />
              {action}
            </li>
          ))}
        </ul>

        <span className="mt-xl inline-flex items-center gap-xs text-body-md font-semibold text-ink">
          Continuer
          <ArrowRight
            size={17}
            strokeWidth={2.25}
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-1"
          />
        </span>
      </Link>

      {secondaire ? (
        <p className="mt-lg border-t border-hairline pt-lg text-body-sm text-mute">
          Pas encore de compte ?{' '}
          <Link href={secondaire.href} className="font-semibold text-ink underline">
            {secondaire.libelle}
          </Link>
        </p>
      ) : null}

      {mention ? (
        <p className="mt-lg border-t border-hairline pt-lg text-body-sm text-mute">
          {mention}
        </p>
      ) : null}
    </div>
  )
}
