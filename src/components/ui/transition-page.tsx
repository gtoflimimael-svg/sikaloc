'use client'

import type { ReactNode } from 'react'

/**
 * Frontière légère pour le contenu serveur des espaces connectés.
 *
 * Les pages Pro et Me sont consultées souvent et contiennent des montants,
 * statuts et formulaires. La navigation reste immédiate ; les menus et
 * confirmations gardent leurs retours visuels propres.
 */
export function TransitionPage({ children }: { children: ReactNode }) {
  return children
}
