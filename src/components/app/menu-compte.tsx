'use client'

import { ChevronDown } from 'lucide-react'

import { AvatarPeep } from '@/components/ui/avatar-peep'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { deconnecter } from '@/lib/actions/auth'

/** Avatar bailleur + menu déroulant, en haut à droite du shell desktop. */
export function MenuCompte({
  id,
  avatar,
  nom,
  email,
  plan,
}: {
  id: string
  avatar: string | null
  nom: string
  email: string
  plan: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return

    function surClic(evenement: MouseEvent) {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false)
    }
    function surEchap(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') setOuvert(false)
    }

    document.addEventListener('mousedown', surClic)
    document.addEventListener('keydown', surEchap)

    return () => {
      document.removeEventListener('mousedown', surClic)
      document.removeEventListener('keydown', surEchap)
    }
  }, [ouvert])

  return (
    <div ref={conteneur} className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="flex items-center gap-sm rounded-pill py-xs pl-xs pr-md hover:bg-canvas-soft"
      >
        <AvatarPeep id={id} avatar={avatar} nom={nom} taille={32} />
        <span className="text-body-sm font-semibold text-ink">{nom}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      {ouvert ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-hairline bg-canvas p-sm shadow-[0_4px_24px_rgb(0_0_0/0.06)]"
        >
          <div className="border-b border-hairline-soft px-md pb-md pt-sm">
            <p className="text-body-sm font-semibold text-ink">{nom}</p>
            <p className="truncate text-caption text-mute">{email}</p>
            <span className="badge badge-neutral mt-sm">Plan {plan}</span>
          </div>

          <Link
            href="/app/parametres"
            role="menuitem"
            className="mt-sm block rounded-md px-md py-sm text-body-sm text-body hover:bg-canvas-soft"
          >
            Paramètres du compte
          </Link>
          <Link
            href="/app/parametres/parrainage"
            role="menuitem"
            className="block rounded-md px-md py-sm text-body-sm text-body hover:bg-canvas-soft"
          >
            Parrainer un bailleur
          </Link>

          <form action={deconnecter} className="mt-sm border-t border-hairline-soft pt-sm">
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded-md px-md py-sm text-left text-body-sm font-semibold text-negative-darkest hover:bg-negative/5"
            >
              Se déconnecter
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
