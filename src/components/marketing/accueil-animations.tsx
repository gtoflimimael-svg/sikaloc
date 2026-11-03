'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

import styles from '@/app/home-animations.module.css'

/**
 * Mouvement propre à l’accueil : entrée courte, révélations au défilement,
 * puis arrêt. Sans JavaScript ou sans IntersectionObserver, tout reste visible.
 */
export function AccueilAnimations({ children }: { children: ReactNode }) {
  const racine = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = racine.current
    if (!element) return

    element.dataset.motionReady = 'true'

    const elements = Array.from(
      element.querySelectorAll<HTMLElement>('[data-home-reveal]'),
    )
    const preferenceMouvementReduit = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )

    if (preferenceMouvementReduit.matches || !('IntersectionObserver' in window)) {
      element.dataset.homeEntered = 'true'
      for (const cible of elements) cible.dataset.homeRevealed = 'true'
      return
    }

    const frameEntree = window.requestAnimationFrame(() => {
      element.dataset.homeEntered = 'true'
    })

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue
          const cible = entree.target as HTMLElement
          cible.dataset.homeRevealed = 'true'
          observateur.unobserve(cible)
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -7% 0px' },
    )

    for (const cible of elements) observateur.observe(cible)

    return () => {
      window.cancelAnimationFrame(frameEntree)
      observateur.disconnect()
    }
  }, [])

  return (
    <div ref={racine} className={styles.root}>
      {children}
    </div>
  )
}
