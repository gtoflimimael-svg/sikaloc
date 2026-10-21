'use client'

import { ChevronDown } from 'lucide-react'

import { PhotoProfil } from '@/components/ui/photo-profil'
import Link from 'next/link'
import { useEffect, useId, useRef, useState, type KeyboardEvent as EvenementClavierReact } from 'react'

import { deconnecter } from '@/lib/actions/auth'

/** Avatar bailleur + menu déroulant, en haut à droite du shell desktop. */
export function MenuCompte({
  id,
  avatar,
  aPhoto,
  nom,
  email,
  plan,
}: {
  id: string
  avatar: string | null
  /** Le bailleur a-t-il une photo réelle ? Elle prime sur l'avatar. */
  aPhoto: boolean
  nom: string
  email: string
  plan: string
}) {
  const [ouvert, setOuvert] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)
  const declencheur = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const idMenu = useId()

  function fermerAvecFocus() {
    setOuvert(false)
    declencheur.current?.focus()
  }

  function naviguer(evenement: EvenementClavierReact<HTMLDivElement>) {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const courant = items.indexOf(document.activeElement as HTMLElement)
    const index = evenement.key === 'Home' ? 0 : evenement.key === 'End' ? items.length - 1
      : evenement.key === 'ArrowDown' ? (courant + 1) % items.length
      : evenement.key === 'ArrowUp' ? (courant - 1 + items.length) % items.length : -1
    if (index >= 0) { evenement.preventDefault(); items[index]?.focus() }
  }

  useEffect(() => {
    if (!ouvert) return
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    function surClic(evenement: MouseEvent) {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false)
    }
    function surEchap(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        evenement.preventDefault()
        fermerAvecFocus()
      }
    }

    document.addEventListener('mousedown', surClic)
    document.addEventListener('keydown', surEchap)

    return () => {
      document.removeEventListener('mousedown', surClic)
      document.removeEventListener('keydown', surEchap)
    }
  }, [ouvert])

  return (
    <div ref={conteneur} className="relative" onBlur={(evenement) => {
      if (!evenement.currentTarget.contains(evenement.relatedTarget)) setOuvert(false)
    }}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        ref={declencheur}
        id={`${idMenu}-bouton`}
        aria-controls={`${idMenu}-menu`}
        onKeyDown={(evenement) => {
          if (evenement.key === 'ArrowDown') { evenement.preventDefault(); setOuvert(true) }
        }}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="flex items-center gap-sm rounded-pill py-xs pl-xs pr-md hover:bg-canvas-soft"
      >
        <PhotoProfil id={id} avatar={avatar} nom={nom} aPhoto={aPhoto} taille={32} />
        <span className="text-body-sm font-semibold text-ink">{nom}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>

      {ouvert ? (
        <div
          ref={menu}
          id={`${idMenu}-menu`}
          aria-labelledby={`${idMenu}-bouton`}
          onKeyDown={naviguer}
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-hairline bg-canvas p-sm shadow-elevated"
        >
          <div className="border-b border-hairline-soft px-md pb-md pt-sm">
            <p className="text-body-sm font-semibold text-ink">{nom}</p>
            <p className="truncate text-caption text-mute">{email}</p>
            <span className="badge badge-neutral mt-sm">Plan {plan}</span>
          </div>

          <Link
            href="/pro/parametres"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOuvert(false)}
            className="mt-sm block rounded-md px-md py-sm text-body-sm text-body hover:bg-canvas-soft"
          >
            Paramètres du compte
          </Link>
          <Link
            href="/pro/parametres/parrainage"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setOuvert(false)}
            className="block rounded-md px-md py-sm text-body-sm text-body hover:bg-canvas-soft"
          >
            Parrainer un bailleur
          </Link>

          <form action={deconnecter} className="mt-sm border-t border-hairline-soft pt-sm">
            <button
              type="submit"
              role="menuitem"
              tabIndex={-1}
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
