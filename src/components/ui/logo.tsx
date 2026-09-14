import Link from 'next/link'

import {
  COULEUR_MARQUE,
  COULEUR_MARQUE_SUR_SOMBRE,
  HAUTEUR_MARQUE,
  LARGEUR_MARQUE,
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

/* ═══ Le nom de l'espace, posé dans la suite du wordmark ═══════════════════
 *
 * ─── Pourquoi dans le SVG et pas à côté ────────────────────────────────────
 *
 * Parce que « Sikaloc_ » finit par un tiret bas, et que « Pro » ou « Me » ne
 * se colle pas au logo : il le TERMINE. Toute la convention de nommage repose
 * là-dessus, et la traiter comme une étiquette posée à côté aurait perdu ce qui
 * la rend juste.
 *
 * Dans le SVG, le suffixe hérite de la couleur de marque, partage la ligne de
 * base des lettres, et grandit avec le logo — trois choses qu'un `<span>` HTML
 * voisin aurait fallu réaligner à chaque taille.
 *
 * ─── Les trois nombres ─────────────────────────────────────────────────────
 *
 * Le wordmark est une chasse fixe : chaque lettre avance de 259,522 unités, et
 * les glyphes sont tracés à `scale(0.432537)` d'une police de 1000 unités de
 * cadratin — d'où une taille de 432,537 en unités SVG. La ligne de base des
 * sept lettres est à y = 447,9.
 *
 * Le suffixe commence donc une case après le tiret bas, exactement où la
 * huitième lettre se serait posée.
 */
const AVANCE_LETTRE = 259.522
const LIGNE_DE_BASE = 447.9
const CADRATIN = 432.537
/** Départ de la 8e case : le tiret bas occupe la 7e, à 2355,547. */
const DEPART_SUFFIXE = 2355.547 + AVANCE_LETTRE
/** Marge droite, reprise de `LARGEUR_MARQUE` qui dépasse déjà la dernière case de 50. */
const MARGE_DROITE = 50

/** Les noms d'espace tels qu'ils se posent après « Sikaloc_ ». */
export type SuffixeEspace = 'Pro' | 'Me'

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
  espace,
  className = '',
}: {
  href?: string | null
  taille?: 'sm' | 'md' | 'lg'
  surSombre?: boolean
  /** « Pro » ou « Me » — posé dans la suite du wordmark. Omis sur le site public. */
  espace?: SuffixeEspace
  className?: string
}) {
  const hauteur = HAUTEURS[taille]
  const couleur = surSombre ? COULEUR_MARQUE_SUR_SOMBRE : COULEUR_MARQUE

  // La boîte s'élargit du nombre exact de cases occupées par le suffixe.
  const largeurBoite = espace
    ? DEPART_SUFFIXE + espace.length * AVANCE_LETTRE + MARGE_DROITE
    : LARGEUR_MARQUE
  const largeur = Math.round((hauteur * largeurBoite) / HAUTEUR_MARQUE)

  const svg = (
    <svg
      width={largeur}
      height={hauteur}
      viewBox={`0 0 ${largeurBoite} ${HAUTEUR_MARQUE}`}
      fill={couleur}
      stroke="none"
      role="img"
      aria-label={espace ? `Sikaloc_${espace}` : 'Sikaloc'}
      className={className}
    >
      <TracesIcone />
      <TracesTexte />
      {espace ? (
        /*
          Plus gras que le wordmark, et c'est voulu : les tracés figés sont en
          JetBrains Mono Thin, une graisse que l'application ne charge pas. Le
          contraste sert le propos — la marque mère reste légère, l'espace
          s'affirme. « Sikaloc_ » puis « Pro ».
        */
        <text
          x={DEPART_SUFFIXE}
          y={LIGNE_DE_BASE}
          fontFamily="var(--font-mono)"
          fontSize={CADRATIN}
          fontWeight={500}
          // La chasse est imposée : le rendu ne doit pas dériver si la police
          // met un instant à charger, ni si un repli s'y substitue.
          textLength={espace.length * AVANCE_LETTRE}
          lengthAdjust="spacingAndGlyphs"
          fill={couleur}
        >
          {espace}
        </text>
      ) : null}
    </svg>
  )

  if (!href) return svg

  return (
    <Link href={href} className="inline-flex items-center">
      {svg}
    </Link>
  )
}
