'use client'

import {
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  House,
  LogOut,
  ScrollText,
  SlidersHorizontal,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { SikalocSpaceBrand } from '@/components/ui/logo'
import { SelecteurTheme } from '@/components/ui/theme'
import { deconnecter } from '@/lib/actions/auth'
import { ESPACE_ME } from '@/lib/roles'
import styles from './espace.module.css'

/**
 * La navigation de Sikaloc_Me.
 *
 * ─── Pourquoi elle ne ressemble pas à celle de Sikaloc_Pro ──────────────────
 *
 * Pas de barre latérale, pas de tiroir. Sikaloc_Pro en a besoin : sept
 * rubriques, un compteur d'impayés, une action principale. Ici il y a cinq
 * écrans dont un seul porte un réglage — une barre d'onglets suffit.
 *
 * C'est le public qui commande : un bailleur gère depuis un bureau autant que
 * depuis son téléphone, un locataire consulte presque toujours depuis son
 * téléphone, souvent une fois par mois.
 *
 * ─── Un seul repère de navigation, jamais deux ──────────────────────────────
 *
 * Les cinq rubriques restent visibles au téléphone grâce à des libellés courts.
 */

const ONGLETS = [
  { href: ESPACE_ME.racine, libelle: 'Accueil', court: 'Accueil', Icone: House },
  { href: `${ESPACE_ME.racine}/loyers`, libelle: 'Mes loyers', court: 'Loyers', Icone: CalendarDays },
  { href: `${ESPACE_ME.racine}/paiements`, libelle: 'Mes paiements', court: 'Paiements', Icone: Banknote },
  { href: `${ESPACE_ME.racine}/bail`, libelle: 'Mon bail', court: 'Bail', Icone: ScrollText },
  { href: `${ESPACE_ME.racine}/preferences`, libelle: 'Préférences', court: 'Réglages', Icone: SlidersHorizontal },
]

/** `/me` ne doit s'activer que sur lui-même, pas sur `/me/loyers`. */
function estActif(href: string, chemin: string): boolean {
  if (href === ESPACE_ME.racine) return chemin === ESPACE_ME.racine
  return chemin === href || chemin.startsWith(`${href}/`)
}

export function EnTeteMe({
  email,
  aussiBailleur,
}: {
  email: string
  /**
   * Ce compte possède aussi des logements.
   *
   * Quelqu'un qui loue un appartement et en met un autre en location a les
   * deux rôles, et ce n'est pas un cas limite. Sans ce passage, il devrait se
   * déconnecter pour changer d'espace.
   */
  aussiBailleur: boolean
}) {
  const chemin = usePathname()
  const navigation = useRef<HTMLElement>(null)
  useEffect(() => {
    navigation.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [chemin])

  return (
    <header className="me-navigation sticky top-0 z-40 border-b border-hairline bg-canvas/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[900px] items-center justify-between gap-xs px-md sm:gap-md sm:px-lg">
        {/*
          Le nom de l'espace est DANS la marque, pas à côté d'elle.

          Il vivait ici, dans un `<span>` masqué en dessous de 640 px — donc
          invisible sur la plupart des téléphones, et sur tous ceux du public de
          Sikaloc_Me. Le repère qui distingue les deux espaces disparaissait
          précisément là où il sert le plus.
        */}
        <SikalocSpaceBrand href={ESPACE_ME.racine} taille="sm" espace="Me" />

        <div className="flex shrink-0 items-center gap-xs">
          <SelecteurTheme compact />

          {aussiBailleur ? (
            <Link
              href="/entrer?choix=1"
              className="btn btn-tertiary btn-sm"
              title="Aller à Sikaloc_Pro"
              aria-label="Changer d’espace"
            >
              <ArrowLeftRight size={16} strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">Changer d’espace</span>
            </Link>
          ) : null}

          <form action={deconnecter}>
            <button type="submit" className="btn-icon" aria-label="Se déconnecter" title={email}>
              <LogOut size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>

      <nav
        ref={navigation}
        aria-label="Sections locataires"
        className="mx-auto max-w-[900px] overflow-x-auto px-md sm:px-lg"
      >
        <ul className={styles.tabs}>
          {ONGLETS.map(({ href, libelle, court, Icone }) => {
            const actif = estActif(href, chemin)
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch
                  aria-current={actif ? 'page' : undefined}
                  className={styles.tab}
                  aria-label={libelle}
                >
                  <Icone size={17} strokeWidth={1.9} aria-hidden="true" />
                  <span className={styles.shortLabel}>{court}</span>
                  <span className={styles.longLabel}>{libelle}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}
