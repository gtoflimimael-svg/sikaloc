import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'

import { MarqueSikaloc } from '@/components/ui/logo'

/**
 * Cadre commun aux écrans d'authentification.
 * Carte blanche et formulaire central ; le panneau éditorial reste secondaire.
 *
 * La connexion et l'inscription peuvent afficher une illustration de marque
 * sur grand écran. Les procédures de sécurité gardent un gabarit sobre.
 */
export function CarteAuth({
  titre,
  description,
  children,
  bas,
  ambiance = false,
}: {
  titre: string
  description?: string
  children: ReactNode
  bas?: ReactNode
  ambiance?: boolean
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas-soft px-lg py-3xl">
      <div
        className={`grid w-full items-stretch gap-2xl ${
          ambiance ? 'max-w-[1060px] lg:grid-cols-[1fr_1fr]' : 'max-w-[480px]'
        }`}
      >
        {ambiance ? (
          <aside className="hidden min-h-[600px] flex-col justify-between overflow-hidden rounded-xl bg-surface-dark p-2xl text-white lg:flex">
            <div>
              <p className="text-caption font-semibold uppercase tracking-widest text-primary-on-dark">Sikaloc Pro</p>
              <h2 className="mt-xl text-display-md font-extrabold text-white">La gestion locative, au clair.</h2>
              <p className="mt-md max-w-[30rem] text-body-md text-on-dark-mute">Vos logements, vos baux et vos documents dans un espace pensé pour les bailleurs.</p>
            </div>
            <Image src="/illustrations/home-02.webp" alt="" width={1200} height={900} sizes="(min-width: 1024px) 45vw, 0px" className="h-auto w-full rounded-lg" />
          </aside>
        ) : null}

        <div className="flex min-w-0 w-full flex-col justify-center">
          <div className="mb-xl flex justify-center anim-apparait">
            <MarqueSikaloc />
          </div>

          <div className="auth-form-card card card-lg anim-monte min-w-0 w-full" style={{ animationDelay: '60ms' }}>
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

      </div>
    </main>
  )
}
