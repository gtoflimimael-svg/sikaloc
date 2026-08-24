import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Rendu du balisage minimal des articles : `**gras**`, `*italique*` et
 * `[texte](/chemin)`.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque Markdown : le besoin tient en
 * trois motifs, et une dépendance de rendu se paierait en poids de paquet sur un
 * marché où beaucoup de visiteurs sont en 3G.
 *
 * Aucune balise HTML brute n'est interprétée : le texte des articles traverse
 * React, qui échappe tout ce qu'il ne reconnaît pas. Un contenu ne peut donc
 * pas injecter de balisage, même par accident.
 */

/** Seuls les liens internes sont acceptés — voir `lien()`. */
const MOTIF = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g

function lien(texte: string, cible: string, cle: number): ReactNode {
  // Un article ne renvoie que vers des pages du site. Un lien externe dans du
  // contenu éditorial demanderait `rel="noopener"` et une décision au cas par
  // cas ; tant qu'aucun n'est nécessaire, on refuse plutôt que d'ouvrir la
  // porte.
  if (!cible.startsWith('/')) return <span key={cle}>{texte}</span>

  return (
    <Link key={cle} href={cible} className="font-semibold text-ink underline">
      {texte}
    </Link>
  )
}

export function TexteRiche({ children }: { children: string }): ReactNode {
  const morceaux = children.split(MOTIF).filter((m) => m !== '')

  return morceaux.map((morceau, i) => {
    if (morceau.startsWith('**') && morceau.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {morceau.slice(2, -2)}
        </strong>
      )
    }

    if (morceau.startsWith('*') && morceau.endsWith('*')) {
      return <em key={i}>{morceau.slice(1, -1)}</em>
    }

    const correspondance = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(morceau)
    if (correspondance) return lien(correspondance[1], correspondance[2], i)

    return <span key={i}>{morceau}</span>
  })
}
