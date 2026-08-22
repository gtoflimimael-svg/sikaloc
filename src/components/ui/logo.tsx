import Link from 'next/link'

import {
  COULEUR_MARQUE,
  COULEUR_MARQUE_SUR_SOMBRE,
  HAUTEUR_MARQUE,
  LARGEUR_MARQUE,
  RATIO_MARQUE,
  TRACES_ICONE,
  TRACES_TEXTE,
  TRANSFORM_ICONE,
} from '@/lib/marque'

/**
 * Marque Sikaloc — le véritable logo (icône tracée + wordmark « Sikaloc_ »).
 *
 * Les tracés eux-mêmes vivent dans `src/lib/marque.ts` : ce fichier n'est plus
 * que leur rendu React, la même donnée servant aussi au PDF des quittances et
 * au logo email (voir le commentaire d'en-tête de ce module pour le pourquoi).
 *
 * Le nom de la marque se termine par un tiret bas — « Sikaloc_ », pas
 * « Sikaloc ». Dans une police à chasse fixe, il se lit comme un curseur de
 * terminal : c'est le détail qui fait la marque, pas une coquille.
 */

const HAUTEURS: Record<'sm' | 'md' | 'lg', number> = { sm: 28, md: 40, lg: 56 }

/** Les deux tracés de l'icône — motif original, inchangé. */
function TracesIcone() {
  return (
    <g transform={TRANSFORM_ICONE}>
      {TRACES_ICONE.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  )
}

/** Le wordmark « Sikaloc_ », en JetBrains Mono Thin — tracés figés, voir `src/lib/marque.ts`. */
function TracesTexte() {
  return (
    <>
      {TRACES_TEXTE.map(({ transform, d }, i) => (
        <g key={i} transform={transform}>
          <path d={d} />
        </g>
      ))}
    </>
  )
}

/** Icône seule — buste sans le nom, pour les espaces trop étroits pour le wordmark. */
export function IconeSikaloc({
  taille = 30,
  couleur = COULEUR_MARQUE,
  className = '',
}: {
  taille?: number
  couleur?: string
  className?: string
}) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 600 600"
      fill={couleur}
      stroke="none"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      <TracesIcone />
    </svg>
  )
}

/** Icône + wordmark « Sikaloc_ » — la marque complète. */
export function MarqueSikaloc({
  href = '/',
  taille = 'md',
  surSombre = false,
  className = '',
}: {
  href?: string | null
  taille?: 'sm' | 'md' | 'lg'
  surSombre?: boolean
  className?: string
}) {
  const hauteur = HAUTEURS[taille]
  const largeur = Math.round(hauteur * RATIO_MARQUE)
  const couleur = surSombre ? COULEUR_MARQUE_SUR_SOMBRE : COULEUR_MARQUE

  const svg = (
    <svg
      width={largeur}
      height={hauteur}
      viewBox={`0 0 ${LARGEUR_MARQUE} ${HAUTEUR_MARQUE}`}
      fill={couleur}
      stroke="none"
      role="img"
      aria-label="Sikaloc"
      className={className}
    >
      <TracesIcone />
      <TracesTexte />
    </svg>
  )

  if (!href) return svg

  return (
    <Link href={href} className="inline-flex items-center">
      {svg}
    </Link>
  )
}
