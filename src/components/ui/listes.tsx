import type { ReactNode } from 'react'

/** Résumé de la collection affichée, sans nouveau calcul métier. */
export function ResumeListe({ children }: { children: ReactNode }) {
  return <div className="list-summary" role="status">{children}</div>
}

/** Le défilement reste dans le tableau et est accessible au clavier. */
export function TableauListe({
  id,
  libelle,
  children,
}: {
  id: string
  libelle: string
  children: ReactNode
}) {
  return (
    <div>
      <p id={`${id}-aide`} className="mb-xs text-caption text-mute">
        Le tableau peut défiler horizontalement pour afficher toutes les colonnes.
      </p>
      <div className="table-defilante" role="region" aria-label={libelle} aria-describedby={`${id}-aide`} tabIndex={0}>
        {children}
      </div>
    </div>
  )
}
