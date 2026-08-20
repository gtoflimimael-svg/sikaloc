import Link from 'next/link'
import type { ReactNode } from 'react'

import { Illustration, type NomIllustration } from '@/components/ui/illustration'
import { MarqueSikaloc } from '@/components/ui/logo'

/**
 * Cadre commun aux écrans d'authentification.
 * Design system : `auth-form-card` — carte blanche, max-width 420px, centrée.
 *
 * Les illustrations de part et d'autre ne sont posées que sur les écrans qui
 * en reçoivent explicitement (connexion, inscription) : la réinitialisation
 * de mot de passe reste sobre, personne n'a envie d'un décor pendant une
 * procédure de sécurité.
 */
export function CarteAuth({
  titre,
  description,
  children,
  bas,
  illustrationGauche,
  illustrationDroite,
}: {
  titre: string
  description?: string
  children: ReactNode
  bas?: ReactNode
  illustrationGauche?: NomIllustration
  illustrationDroite?: NomIllustration
}) {
  const avecDecor = Boolean(illustrationGauche || illustrationDroite)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas-soft px-lg py-3xl">
      <div
        className={`flex w-full items-center justify-center gap-4xl ${
          avecDecor ? 'max-w-[1240px]' : 'max-w-[420px]'
        }`}
      >
        {illustrationGauche ? (
          <div
            aria-hidden="true"
            className="anim-glisse hidden shrink-0 xl:block"
            style={{ animationDelay: '80ms' }}
          >
            <Illustration nom={illustrationGauche} taille={300} decorative className="text-primary-neutral" />
          </div>
        ) : null}

        <div className="w-full max-w-[420px] shrink-0">
          <div className="mb-xl flex justify-center anim-apparait">
            <MarqueSikaloc />
          </div>

          <div className="card card-lg anim-monte" style={{ animationDelay: '60ms' }}>
            <h1 className="text-display-sm font-bold tracking-tight text-ink">{titre}</h1>
            {description ? (
              <p className="mt-xs mb-xl text-body-md text-mute">{description}</p>
            ) : (
              <div className="mb-xl" />
            )}

            {children}
          </div>

          {bas ? <div className="mt-xl text-center text-body-sm text-mute">{bas}</div> : null}

          <p className="mt-2xl text-center">
            <Link href="/" className="text-body-sm text-mute hover:text-ink">
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </div>

        {illustrationDroite ? (
          <div
            aria-hidden="true"
            className="anim-glisse hidden shrink-0 xl:block"
            style={{ animationDelay: '140ms' }}
          >
            <Illustration nom={illustrationDroite} taille={300} decorative className="text-accent-teal" />
          </div>
        ) : null}
      </div>
    </main>
  )
}
