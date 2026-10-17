'use client'

import { Menu } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { SelecteurTheme } from '@/components/ui/theme'

/** Navigation non modale : les liens restent dans le parcours Tab normal. */
export function MenuFind({ liens }: { liens: { href: string; libelle: string }[] }) {
  const details = useRef<HTMLDetailsElement>(null)
  const bouton = useRef<HTMLElement>(null)
  const chemin = usePathname()
  useEffect(() => { if (details.current) details.current.open = false }, [chemin])
  useEffect(() => {
    const fermer = (e: PointerEvent) => {
      if (details.current && !details.current.contains(e.target as Node)) details.current.open = false
    }
    document.addEventListener('pointerdown', fermer)
    return () => document.removeEventListener('pointerdown', fermer)
  }, [])
  return (
    <details ref={details} className="relative lg:hidden" onKeyDown={e => {
      if (e.key === 'Escape' && details.current?.open) {
        e.preventDefault(); details.current.open = false; bouton.current?.focus()
      }
    }}>
      <summary ref={bouton} className="btn-icon list-none cursor-pointer" aria-label="Menu Find"><Menu size={20} aria-hidden="true" /></summary>
      <nav aria-label="Liens Find" className="absolute right-0 top-full mt-xs w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-hairline bg-canvas p-md shadow-elevated">
        <ul className="space-y-xxs">{liens.map(l => <li key={l.href}><Link href={l.href} className="btn btn-tertiary w-full justify-start" onClick={() => { if (details.current) details.current.open = false }}>{l.libelle}</Link></li>)}</ul>
        <div className="mt-md border-t border-hairline pt-md"><SelecteurTheme compact /></div>
      </nav>
    </details>
  )
}
