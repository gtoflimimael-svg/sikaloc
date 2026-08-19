'use client'

import Link from 'next/link'
import {
  Banknote,
  House,
  LayoutDashboard,
  Menu,
  ScrollText,
  Settings,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import { usePathname } from 'next/navigation'

import { AvatarPeep } from '@/components/ui/avatar-peep'
import { SelecteurTheme } from '@/components/ui/theme'
import { useEffect, useState } from 'react'

import { MarqueSikaloc } from '@/components/ui/logo'

export interface LienNav {
  href: string
  libelle: string
  icone: keyof typeof ICONES
  pastille?: number
}

const ICONES = {
  tableau: LayoutDashboard,
  baux: ScrollText,
  locataires: Users,
  logements: House,
  paiements: Banknote,
  impayes: TriangleAlert,
  parametres: Settings,
} as const

export const LIENS_NAV: LienNav[] = [
  { href: '/app', libelle: 'Tableau de bord', icone: 'tableau' },
  { href: '/app/impayes', libelle: 'Impayés', icone: 'impayes' },
  { href: '/app/paiements', libelle: 'Paiements', icone: 'paiements' },
  { href: '/app/baux', libelle: 'Baux', icone: 'baux' },
  { href: '/app/locataires', libelle: 'Locataires', icone: 'locataires' },
  { href: '/app/logements', libelle: 'Logements', icone: 'logements' },
  { href: '/app/parametres', libelle: 'Paramètres', icone: 'parametres' },
]

function Icone({ nom }: { nom: keyof typeof ICONES }) {
  const Glyphe = ICONES[nom]
  return <Glyphe size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
}

/** `/app` ne doit s'activer que sur lui-même, pas sur `/app/baux`. */
function estActif(href: string, chemin: string): boolean {
  if (href === '/app') return chemin === '/app'
  return chemin === href || chemin.startsWith(`${href}/`)
}

function LiensNavigation({
  chemin,
  impayes,
  onNavigation,
}: {
  chemin: string
  impayes: number
  onNavigation?: () => void
}) {
  return (
    <nav className="space-y-xxs">
      {LIENS_NAV.map((lien) => {
        const actif = estActif(lien.href, chemin)
        const pastille = lien.href === '/app/impayes' ? impayes : 0

        return (
          <Link
            key={lien.href}
            href={lien.href}
            onClick={onNavigation}
            aria-current={actif ? 'page' : undefined}
            className={`sidebar-row ${actif ? 'sidebar-row-active' : ''}`}
          >
            <Icone nom={lien.icone} />
            <span className="flex-1">{lien.libelle}</span>
            {pastille > 0 ? (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-pill bg-negative px-xs text-caption font-semibold text-on-primary">
                {pastille}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export function BarreLaterale({ impayes }: { impayes: number }) {
  const chemin = usePathname()

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-hairline bg-canvas lg:block">
      <div className="sticky top-0 flex h-screen flex-col p-lg">
        <div className="mb-xl px-md pt-sm">
          <MarqueSikaloc href="/app" taille="sm" />
        </div>

        <LiensNavigation chemin={chemin} impayes={impayes} />

        <div className="mt-auto space-y-md px-md pb-sm">
          <SelecteurTheme compact />
          <p className="text-caption text-mute-soft">Sikaloc · MVP Bénin</p>
        </div>
      </div>
    </aside>
  )
}

export function EnTeteMobile({
  impayes,
  nomBailleur,
  idBailleur,
  avatarBailleur,
}: {
  impayes: number
  nomBailleur: string
  idBailleur: string
  avatarBailleur: string | null
}) {
  const chemin = usePathname()
  const [ouvert, setOuvert] = useState(false)

  // Une navigation depuis le drawer doit le refermer.
  useEffect(() => setOuvert(false), [chemin])

  // Un drawer ouvert ne doit pas laisser la page défiler derrière lui.
  useEffect(() => {
    document.body.style.overflow = ouvert ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [ouvert])

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-hairline bg-canvas px-lg lg:hidden">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="btn-icon"
          aria-label="Ouvrir le menu"
          aria-expanded={ouvert}
        >
          <Menu size={20} strokeWidth={2} aria-hidden="true" />
        </button>

        <MarqueSikaloc href="/app" taille="sm" />

        <Link
          href="/app/parametres"
          aria-label="Paramètres du compte"
          className="inline-flex items-center rounded-pill"
        >
          <AvatarPeep
            id={idBailleur}
            avatar={avatarBailleur}
            nom={nomBailleur}
            taille={40}
          />
        </Link>
      </header>

      {ouvert ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
            className="absolute inset-0 bg-surface-dark/60"
          />
          <div className="relative flex h-full w-[280px] flex-col bg-canvas p-lg">
            <div className="mb-xl flex items-center justify-between px-md pt-sm">
              <MarqueSikaloc href="/app" taille="sm" />
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="btn-icon"
                aria-label="Fermer le menu"
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <LiensNavigation
              chemin={chemin}
              impayes={impayes}
              onNavigation={() => setOuvert(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
