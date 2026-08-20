import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

import { sectionParametre, type CleParametre } from '@/lib/parametres'

/**
 * En-tête d'un écran de paramètre : « Paramètres / Profil ».
 *
 * Le fil d'Ariane est cliquable sur son premier segment — c'est le chemin de
 * retour vers les blocs, et il vaut mieux qu'une flèche seule : sur mobile,
 * le geste « retour » du navigateur n'existe pas dans une PWA installée.
 */
export function EnteteParametre({ cle }: { cle: CleParametre }) {
  const section = sectionParametre(cle)

  return (
    <div className="mb-xl anim-monte">
      <nav aria-label="Fil d’Ariane" className="mb-sm">
        <ol className="flex flex-wrap items-center gap-xxs text-body-sm">
          <li>
            <Link
              href="/app/parametres"
              className="inline-flex items-center gap-xxs rounded-md px-xs py-xxs -ml-xs text-mute transition-colors hover:bg-canvas hover:text-ink"
            >
              <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
              Paramètres
            </Link>
          </li>
          <li aria-hidden="true" className="text-mute-soft">
            /
          </li>
          <li aria-current="page" className="font-semibold text-ink">
            {section.titre}
          </li>
        </ol>
      </nav>

      <h1 className="text-display-md font-extrabold tracking-tight text-ink">
        {section.titre}
      </h1>
      <p className="mt-xs max-w-[42rem] text-body-md text-mute">
        {section.description}
      </p>
    </div>
  )
}
