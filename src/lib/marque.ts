/**
 * Tracés bruts de la marque Sikaloc — icône + wordmark « Sikaloc_ ».
 *
 * Source unique des données vectorielles, consommée par trois moteurs de
 * rendu différents qui ne peuvent pas partager de JSX entre eux : le SVG web
 * (`src/components/ui/logo.tsx`), le PDF des quittances (`@react-pdf/renderer`,
 * qui a ses propres composants `Svg`/`Path`/`G`), et le script qui rasterise
 * le logo en PNG pour les emails (`scripts/generer-logo-email.ts`, exécuté par
 * `sharp`, hors de tout arbre React). Dupliquer ces ~2 500 caractères de
 * tracés à chaque endroit garantissait qu'ils finiraient par diverger — ce
 * module est donc un simple objet de données, sans JSX, importable partout.
 *
 * Les tracés viennent de `Fichiers de référence/logoskloc.svg`. Voir le
 * commentaire d'en-tête de `logo.tsx` pour le détail du choix (icône
 * inchangée, wordmark JetBrains Mono Thin converti en tracés).
 */

export const COULEUR_MARQUE = '#5C5CCC'
/** `--color-primary-on-dark` du design system : un cran plus clair, pour rester lisible sur fond sombre. */
export const COULEUR_MARQUE_SUR_SOMBRE = '#9A9AEF'

export const LARGEUR_MARQUE = 2665.07
export const HAUTEUR_MARQUE = 600
export const RATIO_MARQUE = LARGEUR_MARQUE / HAUTEUR_MARQUE

/** Transform commune aux deux tracés de l'icône. */
export const TRANSFORM_ICONE = 'translate(0.000000,600.000000) scale(0.100000,-0.100000)'

/** Les deux tracés de l'icône — motif original, inchangé. */
export const TRACES_ICONE: readonly string[] = [
  'M2168 4670 c-71 -12 -144 -38 -238 -85 -262 -132 -431 -341 -523 -650 -29 -96 -31 -356 -4 -457 51 -192 141 -344 285 -479 88 -84 143 -121 245 -169 273 -126 537 -100 813 82 88 58 283 154 317 155 4 1 38 7 75 14 39 8 120 13 192 12 260 -3 465 -94 648 -288 63 -67 92 -108 129 -182 47 -93 48 -98 51 -202 4 -95 2 -109 -17 -132 -23 -29 -65 -42 -112 -32 -44 9 -126 89 -222 218 -155 208 -302 282 -542 273 -119 -5 -160 -16 -284 -76 -94 -45 -214 -157 -275 -255 -106 -171 -112 -373 -14 -545 121 -216 437 -351 814 -351 82 1 172 5 199 10 28 5 66 11 85 14 121 19 310 86 426 150 309 172 528 478 564 788 23 193 1 389 -60 537 -68 164 -139 269 -262 386 -93 88 -175 144 -285 196 -82 39 -252 88 -304 88 -55 0 -207 32 -271 56 -74 28 -165 81 -228 133 -61 51 -125 141 -185 265 -70 142 -149 243 -254 328 -129 104 -273 171 -425 197 -68 12 -268 13 -338 1z m287 -24 c123 -8 274 -63 401 -147 27 -18 90 -74 140 -124 81 -81 97 -103 143 -199 101 -212 205 -332 358 -413 93 -50 237 -91 343 -98 224 -16 503 -157 663 -335 70 -78 137 -185 183 -296 64 -150 78 -224 79 -394 0 -161 -12 -237 -57 -345 -16 -38 -32 -79 -36 -90 -27 -91 -189 -288 -314 -382 -47 -35 -166 -113 -173 -113 -3 0 -38 -15 -78 -34 -99 -46 -179 -71 -332 -102 -118 -23 -145 -25 -300 -21 -175 5 -250 17 -405 68 -201 66 -337 187 -400 354 -30 82 -31 218 0 310 44 133 163 275 290 347 30 17 98 45 150 63 86 29 104 32 200 29 85 -2 119 -8 180 -30 131 -48 234 -133 322 -266 52 -77 94 -124 151 -165 41 -30 58 -37 97 -37 93 0 132 52 132 174 0 86 -16 150 -57 231 -120 236 -352 413 -628 478 -90 21 -245 24 -337 6 -47 -9 -94 -17 -105 -19 -76 -14 -229 -86 -319 -151 -176 -125 -384 -183 -566 -156 -101 14 -105 15 -183 45 -257 97 -462 315 -546 581 -26 81 -51 220 -51 285 0 69 27 209 61 312 112 343 445 614 779 635 52 3 96 7 98 8 2 2 11 1 20 -1 9 -1 53 -5 97 -8z',
  'M1528 2541 c-31 -10 -77 -30 -101 -44 -63 -37 -145 -131 -181 -207 -29 -62 -31 -71 -31 -195 0 -126 1 -132 32 -195 82 -168 239 -270 413 -270 129 0 241 50 332 148 94 102 134 215 126 351 -13 188 -139 352 -316 410 -79 27 -195 27 -274 2z m275 -30 c196 -68 322 -276 289 -477 -22 -130 -105 -254 -212 -316 -288 -167 -650 42 -650 376 0 306 288 515 573 417z',
]

/** Les sept lettres du wordmark « Sikaloc_ », chacune avec sa propre transform. */
export const TRACES_TEXTE: readonly { transform: string; d: string }[] = [
  {
    transform: 'translate(538.892 447.900) scale(0.432537 -0.432537)',
    d: 'M305 -10Q238 -10 188.5 14Q139 38 112 82Q85 126 85 185L135 185Q135 117 181.5 76Q228 35 305 35Q380 35 422.5 72.5Q465 110 465 177Q465 235 432 278Q399 321 342 338L258 363Q186 385 145.5 436.5Q105 488 105 559Q105 615 129.5 655.5Q154 696 199.5 718Q245 740 306 740Q398 740 451.5 688.5Q505 637 505 548L455 548Q455 615 414 655Q373 695 305 695Q235 695 195 660Q155 625 155 563Q155 509 186 468.5Q217 428 270 411L354 385Q428 362 471.5 307Q515 252 515 180Q515 122 489.5 79.5Q464 37 417 13.5Q370 -10 305 -10Z',
  },
  {
    transform: 'translate(798.414 447.900) scale(0.432537 -0.432537)',
    d: 'M95 0L95 45L296 45L296 505L120 505L120 550L346 550L346 45L535 45L535 0ZM315 655Q289 655 273 670Q257 685 257 710Q257 735 273 750Q289 765 315 765Q341 765 357 750Q373 735 373 710Q373 685 357 670Q341 655 315 655Z',
  },
  {
    transform: 'translate(1057.936 447.900) scale(0.432537 -0.432537)',
    d: 'M113 0L113 730L163 730L163 309L295 309L467 550L527 550L342 289L531 0L471 0L295 264L163 264L163 0Z',
  },
  {
    transform: 'translate(1317.459 447.900) scale(0.432537 -0.432537)',
    d: 'M269 -10Q184 -10 133 35Q82 80 82 154Q82 225 129 267.5Q176 310 253 310L442 310L442 375Q442 441 406 477.5Q370 514 304 514Q244 514 205 484.5Q166 455 159 405L109 405Q119 475 172.5 517.5Q226 560 304 560Q389 560 440.5 509Q492 458 492 375L492 0L442 0L442 112L433 112L449 132Q449 68 399.5 29Q350 -10 269 -10ZM283 34Q354 34 398 71Q442 108 442 167L442 266L252 266Q198 266 165 236.5Q132 207 132 158Q132 103 173.5 68.5Q215 34 283 34Z',
  },
  {
    transform: 'translate(1576.981 447.900) scale(0.432537 -0.432537)',
    d: 'M365 0Q320 0 289 15.5Q258 31 241.5 61.5Q225 92 225 135L225 685L50 685L50 730L275 730L275 135Q275 91 298 68Q321 45 365 45L540 45L540 0Z',
  },
  {
    transform: 'translate(1836.503 447.900) scale(0.432537 -0.432537)',
    d: 'M300 -10Q241 -10 197 14.5Q153 39 129 84Q105 129 105 190L105 360Q105 421 129 465.5Q153 510 197 535Q241 560 300 560Q359 560 403 535Q447 510 471 465.5Q495 421 495 360L495 190Q495 129 471 84Q447 39 403.5 14.5Q360 -10 300 -10ZM300 34Q369 34 407 75Q445 116 445 190L445 360Q445 434 406.5 475Q368 516 300 516Q232 516 193.5 475Q155 434 155 360L155 190Q155 116 193 75Q231 34 300 34Z',
  },
  {
    transform: 'translate(2096.025 447.900) scale(0.432537 -0.432537)',
    d: 'M302 -10Q242 -10 197.5 14.5Q153 39 129 84Q105 129 105 190L105 360Q105 421 129 465.5Q153 510 197.5 535Q242 560 302 560Q393 560 446.5 508.5Q500 457 500 370L450 370Q450 438 410.5 476Q371 514 302 514Q234 514 194.5 473.5Q155 433 155 360L155 190Q155 118 194.5 77Q234 36 302 36Q371 36 410.5 74.5Q450 113 450 180L500 180Q500 93 446.5 41.5Q393 -10 302 -10Z',
  },
  {
    transform: 'translate(2355.547 447.900) scale(0.432537 -0.432537)',
    d: 'M60 -70L60 -25L540 -25L540 -70Z',
  },
]

/**
 * Construit un document SVG autonome (icône + wordmark), pour les usages
 * hors React — aujourd'hui uniquement le script qui rasterise le logo en PNG
 * pour les emails.
 */
export function svgMarque({
  couleur = COULEUR_MARQUE,
  fond,
}: {
  couleur?: string
  /** Couleur de fond opaque, sinon transparent. */
  fond?: string
} = {}): string {
  const traces = TRACES_ICONE.map((d) => `<path d="${d}"/>`).join('')
  const texte = TRACES_TEXTE.map(
    ({ transform, d }) => `<g transform="${transform}"><path d="${d}"/></g>`,
  ).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LARGEUR_MARQUE} ${HAUTEUR_MARQUE}" fill="${couleur}" stroke="none">${
    fond ? `<rect width="${LARGEUR_MARQUE}" height="${HAUTEUR_MARQUE}" fill="${fond}"/>` : ''
  }<g transform="${TRANSFORM_ICONE}">${traces}</g>${texte}</svg>`
}
