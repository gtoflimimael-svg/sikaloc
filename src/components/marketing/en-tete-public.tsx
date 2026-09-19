import Link from 'next/link'

import { MenuMobile } from '@/components/marketing/menu-mobile'
import { MarqueSikaloc, type SuffixeEspace } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'

/**
 * La barre du haut des pages publiques.
 *
 * ─── Pourquoi elle devient un composant ─────────────────────────────────────
 *
 * Elle vivait en ligne dans `src/app/page.tsx`, parce qu'une seule page en
 * avait besoin. La séparation entre la marque globale et l'espace bailleur en
 * réclame désormais deux — `/` et `/pro` — et une barre recopiée est une barre
 * qui divergera : un lien corrigé d'un côté, oublié de l'autre.
 *
 * L'extraction est faite à l'identique. Les mesures qui suivent sont celles
 * d'origine ; elles n'ont pas été refaites, elles ont été déplacées.
 */

export interface LienEnTete {
  href: string
  libelle: string
}

/**
 * Les ancres de la page de vente bailleur.
 *
 * Elles ne valent que sur une page qui porte réellement ces sections. C'est
 * pourquoi elles sont passées en propriété plutôt que figées ici : la page
 * d'accueil globale n'a pas les mêmes.
 */
export const LIENS_PRO: LienEnTete[] = [
  { href: '#fonctionnalites', libelle: 'Fonctionnalités' },
  { href: '#etapes', libelle: 'Comment ça marche' },
  { href: '#tarifs', libelle: 'Tarifs' },
]

/**
 * Le tiroir mobile de `/pro` — les mêmes ancres, plus deux que la barre de
 * bureau n'a pas la place de porter.
 *
 * Reprise à l'identique de l'ancienne liste figée de `MenuMobile`, ordre
 * compris : « Comment ça marche » vient avant « Fonctionnalités » dans le
 * document, et un menu qui annonce un autre ordre que celui du défilement fait
 * passer les ancres pour des pages séparées.
 */
export const LIENS_TIROIR_PRO: LienEnTete[] = [
  { href: '#etapes', libelle: 'Comment ça marche' },
  { href: '#fonctionnalites', libelle: 'Fonctionnalités' },
  { href: '#tarifs', libelle: 'Tarifs' },
  { href: '#faq', libelle: 'Questions fréquentes' },
  { href: '#locataire', libelle: 'Je suis locataire' },
]

export function EnTetePublic({
  connecte,
  liens,
  liensTiroir = liens,
  destinationTableauDeBord,
  espace,
  marqueHref = '/',
}: {
  connecte: boolean
  /**
   * Ancres de navigation — OBLIGATOIRES, sans valeur par défaut.
   *
   * Elles en avaient une : les ancres de la page bailleur. Une page qui aurait
   * oublié de passer les siennes aurait affiché des liens relatifs vers des
   * sections qu'elle ne porte pas, sans que rien ne le signale. Rendue
   * obligatoire, l'omission devient une erreur de compilation.
   */
  liens: LienEnTete[]
  /**
   * Entrées du tiroir mobile. Par défaut, les mêmes que la barre — ce qui est
   * toujours juste, puisque chaque page ne déclare que ses propres ancres.
   */
  liensTiroir?: LienEnTete[]
  /**
   * Simple relais vers `MenuMobile`, qui porte le vrai défaut — voir son
   * commentaire. Laissé `undefined` ici, `/pro` n'a rien à changer.
   */
  destinationTableauDeBord?: string
  /** « Pro » ou « Me » accolé au wordmark. Omis sur la marque globale. */
  espace?: SuffixeEspace
  /** Destination du logo. */
  marqueHref?: string
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-sm px-lg xl:px-xl">
        {/*
          Le wordmark fait 178 px de large en taille `md` — à lui seul, plus
          de la moitié d'un écran de 360 px. La barre passe donc à la taille
          `sm` sous `lg`, comme le fait déjà l'en-tête de l'application
          (`EnTeteMobile`). Deux rendus plutôt qu'une classe responsive :
          la taille pilote la largeur du SVG, pas seulement sa police.

          Le basculement se fait à `lg` et non à `md` : à exactement 768 px,
          le wordmark en taille `md`, les trois ancres, le sélecteur de thème
          et les deux boutons réclamaient ensemble 854 px pour 768 px
          disponibles — l'en-tête débordait. Le tiroir couvre donc aussi la
          tranche 768–1023 px, celle des tablettes en portrait.
        */}
        <span className="lg:hidden">
          <MarqueSikaloc href={marqueHref} taille="sm" espace={espace} />
        </span>
        <span className="hidden lg:block">
          <MarqueSikaloc href={marqueHref} espace={espace} />
        </span>

        {/*
          L'écart entre les ancres et les marges internes ne passent à leur
          valeur confortable qu'à partir de `xl`. À exactement 1024 px, la
          largeur du point de bascule, la barre consommait 949 px pour 960 px
          disponibles : 11 px de marge, de quoi déborder au premier libellé
          rallongé ou à la première ancre ajoutée. Les deux réglages rendent
          32 px sans que rien ne se voie, et la respiration d'origine revient
          dès 1280 px, où la place ne manque plus.
        */}
        <div className="hidden items-center gap-lg lg:flex xl:gap-xl">
          {liens.map(({ href, libelle }) => (
            <Link key={href} href={href} className="text-nav-link text-body hover:text-ink">
              {libelle}
            </Link>
          ))}
        </div>

        {/*
          Sous `md`, la barre ne garde qu'une seule action plus le tiroir :
          « Se connecter » et « Commencer » côte à côte poussaient l'en-tête
          à 447 px de large pour un écran de 360 px, et la page débordait
          horizontalement. « Commencer » reste dehors — un CTA rangé dans un
          menu n'est plus un CTA — et le reste passe dans le tiroir.
        */}
        <div className="flex items-center gap-sm">
          <div className="hidden sm:block">
            <SelecteurTheme compact />
          </div>
          {connecte ? (
            // `/entrer` plutôt que `/pro` : il aiguille selon les rôles et ne
            // pose la question qu'à qui possède les deux. Un bailleur ne voit
            // donc aucune étape de plus.
            <Link href="/entrer" className="btn btn-primary btn-sm">
              Mon tableau de bord
            </Link>
          ) : (
            <>
              {/*
                « Se connecter » mène au choix d'espace : c'est le seul point
                du site où quelqu'un qui revient peut être aussi bien bailleur
                que locataire. Les appels à l'action plus bas, eux, restent
                dirigés vers l'inscription bailleur — cette page vend
                Sikaloc_Pro, et un sélecteur y ajouterait une étape à un
                parcours qui convertit.
              */}
              <Link href="/entrer" className="btn btn-secondary btn-sm max-lg:hidden">
                Se connecter
              </Link>
              <Link href="/inscription" className="btn btn-primary btn-sm">
                Commencer
              </Link>
            </>
          )}

          <MenuMobile
            connecte={connecte}
            liens={liensTiroir}
            destinationTableauDeBord={destinationTableauDeBord}
          />
        </div>
      </nav>
    </header>
  )
}
