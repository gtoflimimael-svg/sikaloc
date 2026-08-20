'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Entrée de page.
 *
 * Le contenu applicatif remonte de quelques pixels à chaque navigation, ce qui
 * distingue « la page a changé » de « rien ne s'est passé » — utile quand deux
 * écrans se ressemblent, comme la liste des baux et celle des logements.
 *
 * L'astuce tient dans la clé : changer `key` démonte puis remonte le sous-arbre,
 * ce qui rejoue l'animation CSS. Les enfants restent des composants serveur,
 * ils ne font que traverser.
 */
export function TransitionPage({ children }: { children: ReactNode }) {
  const chemin = usePathname()

  return (
    <div key={chemin} className="anim-page">
      {children}
    </div>
  )
}
