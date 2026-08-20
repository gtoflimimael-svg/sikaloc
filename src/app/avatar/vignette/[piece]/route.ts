import { ATOMES } from '@/lib/avatar/atomes'
import { CATEGORIES, NB_OPTIONS, type Categorie } from '@/lib/avatar/tailles'

/**
 * Vignette d'une option d'avatar — `/avatar/vignette/coiffure-7.svg`.
 *
 * Pourquoi une vignette par option plutôt que l'avatar complet répété :
 * l'aperçu « moi avec cette coiffure » obligerait à régénérer les 24 images
 * dès que le bailleur change de tenue, et ferait tomber le cache à chaque
 * clic. Ici, une vignette ne dépend que de son couple (catégorie, index) :
 * elle est donc immuable, et le navigateur ne la télécharge qu'une fois.
 *
 * Les catégories qui n'ont pas de sens isolées (une expression, une barbe ou
 * des lunettes flottant dans le vide) sont composées sur une tête neutre.
 */

const DECALAGES: Record<Categorie, [number, number]> = {
  tenue: [147, 639],
  coiffure: [372, 180],
  visage: [531, 366],
  pilosite: [495, 518],
  accessoire: [419, 421],
}

/** Index de la coiffure et de l'expression servant de support neutre. */
const COIFFURE_NEUTRE = 20 // « Mi-longs » — compacte, sans genre marqué.
const VISAGE_NEUTRE = 3 // « Serein ».

/**
 * Cadrages mesurés sur les tracés réels (voir scripts/generer-noms-avatar.mts) :
 * la tête occupe x 222→955 / y 60→981, le visage x 567→793 / y 402→647.
 */
const CADRES: Record<Categorie, string> = {
  tenue: '140 170 880 880',
  coiffure: '205 50 770 770',
  visage: '350 235 540 540',
  pilosite: '350 235 540 540',
  accessoire: '350 235 540 540',
}

/** Ce qu'il faut poser sous l'option pour qu'elle se lise. */
const SUPPORTS: Record<Categorie, Partial<Record<Categorie, number>>> = {
  tenue: { coiffure: COIFFURE_NEUTRE, visage: VISAGE_NEUTRE },
  coiffure: {},
  visage: { coiffure: COIFFURE_NEUTRE },
  pilosite: { coiffure: COIFFURE_NEUTRE, visage: VISAGE_NEUTRE },
  accessoire: { coiffure: COIFFURE_NEUTRE, visage: VISAGE_NEUTRE },
}

const TRAIT = '#5C5CCC'
const PAPIER = '#F4F4FB'

function couche(cat: Categorie, index: number): string {
  const [x, y] = DECALAGES[cat]
  return `<g transform="translate(${x} ${y})">${ATOMES[cat][index].svg}</g>`
}

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ piece: string }> },
) {
  const { piece } = await params
  const [categorie, brut] = piece.replace(/\.svg$/, '').split('-')

  if (!CATEGORIES.includes(categorie as Categorie)) {
    return new Response('Catégorie inconnue', { status: 400 })
  }

  const cat = categorie as Categorie
  const index = Number(brut)

  if (!Number.isInteger(index) || index < 0 || index >= NB_OPTIONS[cat]) {
    return new Response('Option inconnue', { status: 400 })
  }

  // L'ordre de dessin suit celui de l'avatar complet : la tenue derrière, les
  // accessoires devant. Sans quoi une barbe passerait sous le menton.
  const support = SUPPORTS[cat]
  const couches = CATEGORIES.filter((c) => c === cat || support[c] !== undefined)
    .map((c) => couche(c, c === cat ? index : support[c]!))
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CADRES[cat]}" width="192" height="192" role="img" aria-label="Option d’avatar">` +
    `<g fill="none" fill-rule="evenodd">${couches}</g>` +
    `</svg>`

  return new Response(
    svg.replaceAll('currentColor', TRAIT).replaceAll('var(--peep-papier, #ffffff)', PAPIER),
    {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        // Le couple (catégorie, index) désigne toujours le même tracé : la
        // vignette est immuable pour la durée de vie du déploiement.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}
