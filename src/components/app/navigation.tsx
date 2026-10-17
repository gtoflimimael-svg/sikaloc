'use client'

import {
  Banknote,
  House,
  LayoutDashboard,
  LogOut,
  Megaphone,
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
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import { PhotoProfil } from '@/components/ui/photo-profil'
import { MarqueSikaloc } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'
import { deconnecter } from '@/lib/actions/auth'
import { ESPACE_PRO } from '@/lib/roles'

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
  annonces: Megaphone,
  paiements: Banknote,
  impayes: TriangleAlert,
  parametres: Settings,
} as const

export const LIENS_NAV: LienNav[] = [
  { href: ESPACE_PRO.tableauDeBord, libelle: 'Tableau de bord', icone: 'tableau' },
  { href: '/pro/impayes', libelle: 'Impayés', icone: 'impayes' },
  { href: '/pro/paiements', libelle: 'Paiements', icone: 'paiements' },
  { href: '/pro/baux', libelle: 'Baux', icone: 'baux' },
  { href: '/pro/locataires', libelle: 'Locataires', icone: 'locataires' },
  { href: '/pro/logements', libelle: 'Logements', icone: 'logements' },
  { href: '/pro/annonces', libelle: 'Annonces', icone: 'annonces' },
  { href: '/pro/parametres', libelle: 'Paramètres', icone: 'parametres' },
]

function Icone({ nom }: { nom: keyof typeof ICONES }) {
  const Glyphe = ICONES[nom]
  return <Glyphe size={20} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
}

/*
 * Le cas particulier de `/pro` a disparu avec le déplacement du tableau de
 * bord.
 *
 * Il existait parce que `/pro` ÉTAIT le tableau de bord : sans lui, l'onglet
 * serait resté allumé sur `/pro/baux` comme sur tout le reste de l'espace.
 * `/pro/tableau-de-bord` est une feuille — la règle générale lui suffit.
 */
function estActif(href: string, chemin: string): boolean {
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
    <nav aria-label="Navigation Sikaloc Pro" className="space-y-xxs">
      {LIENS_NAV.map((lien) => {
        const actif = estActif(lien.href, chemin)
        const pastille = lien.href === '/pro/impayes' ? impayes : 0

        return (
          <Link
            key={lien.href}
            href={lien.href}
            prefetch
            onClick={onNavigation}
            aria-current={actif ? 'page' : undefined}
            // Repère de la visite guidée. Il désigne un élément RÉEL de
            // l'interface : c'est ce qui distingue une visite d'une boîte de
            // dialogue posée au milieu de l'écran.
            data-visite={`nav-${lien.icone}`}
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
      <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto p-md">
        <div className="mb-xl px-md pt-sm">
          <MarqueSikaloc href={ESPACE_PRO.tableauDeBord} taille="sm" espace="Pro" />
        </div>

        <LiensNavigation chemin={chemin} impayes={impayes} />

        <div className="mt-auto space-y-md px-md pb-sm">
          <SelecteurTheme compact />
          {/*
            Le nom de l'espace ne se répète plus ici : il est désormais dans la
            marque, en haut de cette même colonne. Le redire deux fois dans un
            écran ne le rend pas plus lisible, seulement plus bruyant.
          */}
          <p className="text-caption text-mute-soft">Bénin</p>
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
  aPhotoBailleur,
  emailBailleur,
  plan,
}: {
  impayes: number
  nomBailleur: string
  idBailleur: string
  avatarBailleur: string | null
  /** Le bailleur a-t-il une photo réelle ? Elle prime sur l'avatar. */
  aPhotoBailleur: boolean
  emailBailleur: string
  plan: string
}) {
  const chemin = usePathname()
  const [ouvert, setOuvert] = useState(false)
  const tiroir = useRef<HTMLDialogElement>(null)
  const idTiroir = useId()

  function contenirFocus(evenement: KeyboardEvent<HTMLDialogElement>) {
    if (evenement.key !== 'Tab') return
    const elements = Array.from(tiroir.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') ?? [])
      .filter((element) => element.getClientRects().length > 0)
    const premier = elements[0]
    const dernier = elements.at(-1)
    if (evenement.shiftKey && document.activeElement === premier) {
      evenement.preventDefault()
      dernier?.focus()
    } else if (!evenement.shiftKey && document.activeElement === dernier) {
      evenement.preventDefault()
      premier?.focus()
    }
  }

  // Une navigation depuis le tiroir doit le refermer. Le faire pendant le
  // rendu escamoterait l'animation de fermeture.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setOuvert(false), [chemin])

  // Un tiroir ouvert ne doit pas laisser la page défiler derrière lui.
  useEffect(() => {
    if (!ouvert) return
    const precedent = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = precedent
    }
  }, [ouvert])

  // Le dialogue natif isole le fond, contient Tab et restaure le focus.
  useEffect(() => {
    const dialogue = tiroir.current
    if (!dialogue) return
    if (ouvert && !dialogue.open) {
      dialogue.showModal()
      dialogue.querySelector<HTMLButtonElement>('[data-fermer]')?.focus()
    } else if (!ouvert && dialogue.open) {
      dialogue.close()
    }
  }, [ouvert])

  useEffect(() => {
    const bureau = window.matchMedia('(min-width: 1024px)')
    const fermerSurBureau = () => { if (bureau.matches) setOuvert(false) }
    bureau.addEventListener('change', fermerSurBureau)
    return () => bureau.removeEventListener('change', fermerSurBureau)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-xs border-b border-hairline bg-canvas/95 px-md backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="btn-icon"
          aria-label="Ouvrir le menu"
          aria-expanded={ouvert}
          aria-controls={idTiroir}
          aria-haspopup="dialog"
        >
          <Menu size={20} strokeWidth={2} aria-hidden="true" />
        </button>

        <MarqueSikaloc href={ESPACE_PRO.tableauDeBord} taille="sm" espace="Pro" />

        <div className="flex items-center gap-xs">
          <Link
            href="/pro/paiements/nouveau"
            aria-label="Enregistrer un paiement"
            data-visite="bouton-paiement"
            className="btn btn-primary size-9 rounded-pill p-0 sm:h-9 sm:w-auto sm:rounded-md sm:px-md"
          >
            <Plus size={17} strokeWidth={2.2} aria-hidden="true" />
            <span className="hidden sm:inline">Paiement</span>
          </Link>

          <button
            type="button"
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu du compte"
            aria-expanded={ouvert}
            aria-controls={idTiroir}
            aria-haspopup="dialog"
            className="inline-flex items-center rounded-pill"
          >
            <PhotoProfil
              id={idBailleur}
              avatar={avatarBailleur}
              aPhoto={aPhotoBailleur}
              nom={nomBailleur}
              taille={36}
            />
          </button>
        </div>
      </header>

      <dialog
        ref={tiroir}
        id={idTiroir}
        aria-label="Menu Sikaloc Pro"
        className="nav-dialog"
        onKeyDown={contenirFocus}
        onCancel={() => setOuvert(false)}
        onClose={() => setOuvert(false)}
        onClick={(evenement) => { if (evenement.target === evenement.currentTarget) setOuvert(false) }}
      >
          <div className="anim-glisse relative flex h-full w-[86vw] max-w-[320px] flex-col overflow-y-auto bg-canvas p-md shadow-modal">
            <div className="mb-lg flex items-center justify-between px-md pt-sm">
              <MarqueSikaloc href={ESPACE_PRO.tableauDeBord} taille="sm" espace="Pro" />
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="btn-icon"
                aria-label="Fermer le menu"
                data-fermer
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {/* Bloc compte — l'équivalent mobile du menu en haut à droite. */}
            <div className="mb-lg rounded-lg border border-hairline bg-surface-soft p-md">
              <div className="flex items-center gap-sm">
                <PhotoProfil
                  id={idBailleur}
                  avatar={avatarBailleur}
                  aPhoto={aPhotoBailleur}
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
              href="/pro/paiements/nouveau"
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
      </dialog>
    </>
  )
}
