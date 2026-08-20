'use client'

import {
  Banknote,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Settings,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AvatarPeep } from '@/components/ui/avatar-peep'
import { MarqueSikaloc } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'
import { deconnecter } from '@/lib/actions/auth'

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
            prefetch
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

/**
 * En-tête et tiroir mobile.
 *
 * Le tiroir porte tout ce que la barre latérale et l'en-tête de bureau
 * offrent : l'action principale, la navigation, le thème, et surtout le bloc
 * compte avec la déconnexion. Une application où l'on ne peut pas se
 * déconnecter depuis son téléphone n'est pas « adaptée au mobile », elle est
 * amputée — c'était le cas ici, l'avatar mobile menant droit aux paramètres.
 */
export function EnTeteMobile({
  impayes,
  nomBailleur,
  idBailleur,
  avatarBailleur,
  emailBailleur,
  plan,
}: {
  impayes: number
  nomBailleur: string
  idBailleur: string
  avatarBailleur: string | null
  emailBailleur: string
  plan: string
}) {
  const chemin = usePathname()
  const [ouvert, setOuvert] = useState(false)

  // Une navigation depuis le tiroir doit le refermer.
  useEffect(() => setOuvert(false), [chemin])

  // Un tiroir ouvert ne doit pas laisser la page défiler derrière lui.
  useEffect(() => {
    document.body.style.overflow = ouvert ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [ouvert])

  // Échap referme, comme partout ailleurs dans l'application.
  useEffect(() => {
    if (!ouvert) return
    function surEchap(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('keydown', surEchap)
    return () => document.removeEventListener('keydown', surEchap)
  }, [ouvert])

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-sm border-b border-hairline bg-canvas/95 px-lg backdrop-blur lg:hidden">
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

        <div className="flex items-center gap-xs">
          <Link
            href="/app/paiements/nouveau"
            aria-label="Enregistrer un paiement"
            className="btn btn-primary size-9 rounded-pill p-0 sm:h-9 sm:w-auto sm:rounded-md sm:px-md"
          >
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
            <span className="hidden sm:inline">Paiement</span>
          </Link>

          <button
            type="button"
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu du compte"
            className="inline-flex items-center rounded-pill"
          >
            <AvatarPeep
              id={idBailleur}
              avatar={avatarBailleur}
              nom={nomBailleur}
              taille={36}
            />
          </button>
        </div>
      </header>

      {ouvert ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
            className="anim-apparait absolute inset-0 bg-surface-dark/60"
          />

          <div className="anim-glisse relative flex h-full w-[86vw] max-w-[320px] flex-col overflow-y-auto bg-canvas p-lg">
            <div className="mb-lg flex items-center justify-between px-md pt-sm">
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

            {/* Bloc compte — l'équivalent mobile du menu en haut à droite. */}
            <div className="mb-lg rounded-lg border border-hairline bg-surface-soft p-md">
              <div className="flex items-center gap-sm">
                <AvatarPeep
                  id={idBailleur}
                  avatar={avatarBailleur}
                  nom={nomBailleur}
                  taille={40}
                />
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-semibold text-ink">
                    {nomBailleur}
                  </p>
                  <p className="truncate text-caption text-mute">{emailBailleur}</p>
                </div>
              </div>
              <span className="badge badge-neutral mt-sm">Plan {plan}</span>
            </div>

            <Link
              href="/app/paiements/nouveau"
              onClick={() => setOuvert(false)}
              className="btn btn-primary mb-lg w-full"
            >
              Enregistrer un paiement
            </Link>

            <LiensNavigation
              chemin={chemin}
              impayes={impayes}
              onNavigation={() => setOuvert(false)}
            />

            <div className="mt-auto space-y-md pt-xl">
              <SelecteurTheme />

              <form action={deconnecter}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-sm rounded-md border border-hairline px-md py-sm text-body-sm font-semibold text-negative-darkest transition-colors hover:bg-negative/5"
                >
                  <LogOut size={17} strokeWidth={2} aria-hidden="true" />
                  Se déconnecter
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
