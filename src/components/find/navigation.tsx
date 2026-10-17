import Link from 'next/link'

import { MenuFind } from '@/components/find/menu'
import { PiedDePage } from '@/components/marketing/pied-de-page'
import { MarqueSikaloc } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'

const LIENS = [
  { href: '/find', libelle: 'Tous les logements' },
  { href: '/me/candidatures', libelle: 'Mes candidatures' },
]

/** Find privilégie la recherche et le suivi ; un menu de liens compact reste non modal. */
export function EnTeteFind({ connecte }: { connecte: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
      <a href="#contenu" className="skip-link">Aller au contenu</a>
      <nav aria-label="Navigation Find" className="mx-auto flex min-h-16 max-w-[1200px] items-center justify-between gap-sm px-md sm:px-xl">
        <MarqueSikaloc href="/find" taille="sm" espace="Find" />
        <div className="hidden items-center gap-lg lg:flex">
          {LIENS.map(l => <Link key={l.href} href={l.href} className="text-body-sm text-body hover:text-ink">{l.libelle}</Link>)}
        </div>
        <div className="flex shrink-0 items-center gap-xs">
          <div className="hidden sm:block"><SelecteurTheme compact /></div>
          {connecte ? (
            <Link href="/me/candidatures" aria-label="Mes candidatures" className="btn btn-primary btn-sm"><span className="sm:hidden">Suivi</span><span className="hidden sm:inline">Mes candidatures</span></Link>
          ) : <Link href="/connexion?suite=%2Ffind" className="btn btn-secondary btn-sm">Connexion</Link>}
          <MenuFind liens={[{ href: '/', libelle: 'Accueil Sikaloc' }, { href: '/#espaces', libelle: 'Les espaces' }, ...LIENS, { href: '/me/rejoindre', libelle: 'Je suis locataire' }, { href: '/pro', libelle: 'Bailleurs' }]} />
        </div>
      </nav>
    </header>
  )
}

/** Les liens institutionnels restent disponibles sans dominer le catalogue mobile. */
export function PiedDePageFind() {
  return (
    <div className="border-t border-hairline bg-canvas">
      <div className="mx-auto max-w-[1200px] px-md py-lg sm:px-xl">
        <nav aria-label="Liens utiles Find" className="flex flex-wrap gap-sm text-body-sm">
          <Link href="/find" className="btn btn-tertiary btn-sm">Chercher un logement</Link>
          <Link href="/me/candidatures" className="btn btn-tertiary btn-sm">Suivre mes candidatures</Link>
          <Link href="/legal/confidentialite" className="btn btn-tertiary btn-sm">Confidentialité</Link>
        </nav>
        <details className="mt-md">
          <summary className="min-h-11 cursor-pointer py-sm text-body-sm text-mute">Aide, informations légales et autres espaces Sikaloc</summary>
          <PiedDePage />
        </details>
      </div>
    </div>
  )
}
