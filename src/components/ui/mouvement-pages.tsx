'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect } from 'react'

import styles from '@/app/mouvement-pages.module.css'

const ATTR_ENTREE = 'data-sikaloc-page-entered'
const ATTR_PRET = 'data-sikaloc-page-ready'
const ATTR_TITRE = 'data-sikaloc-motion-heading'
const ATTR_REVEAL = 'data-sikaloc-motion-reveal'

/**
 * Transition légère des pages, hors accueil qui possède son propre rythme.
 * Les contenus éditoriaux dévoilent leurs blocs à mesure du défilement ; les
 * chiffres, formulaires et tableaux ne sont ni décalés ni animés en cascade.
 */
export function MouvementPages() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    if (!pathname || pathname === '/') return

    const main =
      document.querySelector<HTMLElement>('main#contenu-principal') ??
      document.querySelector<HTMLElement>('main#contenu') ??
      document.querySelector<HTMLElement>('main')

    if (!main) return

    const preferenceMouvementReduit = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )
    if (preferenceMouvementReduit.matches) return

    const titres = Array.from(main.querySelectorAll<HTMLElement>('h1'))
    for (const titre of titres) titre.setAttribute(ATTR_TITRE, 'true')

    const ciblesRevelees = trouverCiblesEditoriales(main, pathname)
    main.classList.add(styles.page)
    main.setAttribute(ATTR_PRET, 'true')

    let observateur: IntersectionObserver | null = null

    const toutReveler = () => {
      main.setAttribute(ATTR_ENTREE, 'true')
      for (const cible of ciblesRevelees) cible.setAttribute(ATTR_REVEAL, 'visible')
      observateur?.disconnect()
    }

    for (const cible of ciblesRevelees) cible.setAttribute(ATTR_REVEAL, 'pending')

    if ('IntersectionObserver' in window && ciblesRevelees.length > 0) {
      observateur = new IntersectionObserver(
        (entrees) => {
          for (const entree of entrees) {
            if (!entree.isIntersecting) continue
            const cible = entree.target as HTMLElement
            cible.setAttribute(ATTR_REVEAL, 'visible')
            observateur?.unobserve(cible)
          }
        },
        { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
      )
      for (const cible of ciblesRevelees) observateur.observe(cible)
    } else {
      for (const cible of ciblesRevelees) cible.setAttribute(ATTR_REVEAL, 'visible')
    }

    const frameEntree = window.requestAnimationFrame(() => {
      main.setAttribute(ATTR_ENTREE, 'true')
    })

    const surPreferenceMouvement = (evenement: MediaQueryListEvent) => {
      if (evenement.matches) toutReveler()
    }
    preferenceMouvementReduit.addEventListener('change', surPreferenceMouvement)

    return () => {
      window.cancelAnimationFrame(frameEntree)
      preferenceMouvementReduit.removeEventListener('change', surPreferenceMouvement)
      observateur?.disconnect()
      main.classList.remove(styles.page)
      main.removeAttribute(ATTR_PRET)
      main.removeAttribute(ATTR_ENTREE)
      for (const titre of titres) titre.removeAttribute(ATTR_TITRE)
      for (const cible of ciblesRevelees) cible.removeAttribute(ATTR_REVEAL)
    }
  }, [pathname])

  return null
}

function trouverCiblesEditoriales(main: HTMLElement, pathname: string): HTMLElement[] {
  if (pathname === '/pro') {
    return Array.from(main.querySelectorAll<HTMLElement>(':scope > section:not(:first-child)'))
  }

  if (pathname === '/blog') {
    return Array.from(main.querySelectorAll<HTMLElement>(':scope > ol > li'))
  }

  if (pathname.startsWith('/blog/')) {
    return Array.from(main.children).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        (element.tagName === 'DIV' || element.tagName === 'SECTION'),
    )
  }

  return []
}
