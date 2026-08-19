import Link from 'next/link'
import type { ReactNode } from 'react'

import { MarqueSikaloc } from '@/components/ui/logo'

/**
 * Cadre commun aux écrans d'authentification.
 * Design system : `auth-form-card` — carte blanche, max-width 420px, centrée.
 */
export function CarteAuth({
  titre,
  description,
  children,
  bas,
}: {
  titre: string
  description?: string
  children: ReactNode
  bas?: ReactNode
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas-soft px-lg py-3xl">
      <div className="w-full max-w-[420px]">
        <div className="mb-xl flex justify-center">
          <MarqueSikaloc />
        </div>

        <div className="card card-lg">
          <h1 className="text-display-sm font-semibold tracking-tight text-ink">{titre}</h1>
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
    </main>
  )
}
