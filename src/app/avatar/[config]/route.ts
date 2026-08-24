import { ATOMES } from '@/lib/avatar/atomes'
import { CATEGORIES, decoder, type Categorie } from '@/lib/avatar/config'

/**
 * Rendu d'un avatar Open Peeps composé, servi en SVG.
 *
 * Pourquoi une route et pas un composant : les 563 Ko de tracés restent côté
 * serveur, le navigateur met chaque avatar en cache par son URL, et un simple
 * <img> fonctionne aussi bien dans un composant serveur que client.
 *
 * Les décalages ci-dessous sont ceux du gabarit officiel
 * « Separate Atoms/a person/bust.svg » (viewBox 1136×1533) : ils sont ce qui
 * fait qu'une coiffure tombe bien sur un visage.
 */
const DECALAGES: Record<Categorie, [number, number]> = {
  tenue: [147, 639],
  coiffure: [372, 180],
  visage: [531, 366],
  pilosite: [495, 518],
  accessoire: [419, 421],
}

/** Cadrage buste : centré sur la tête, épaules amorcées. */
const CADRE = '133 105 950 950'

/**
 * Couleurs cuites dans le fichier. Un <img> ne peut pas hériter de
 * `currentColor` : l'avatar garde donc son propre fond clair dans les deux
 * thèmes, comme le ferait une photo.
 */
const TRAIT = '#5555BC'
const PAPIER = '#F4F4FB'

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ config: string }> },
) {
  const { config: brut } = await params
  const config = decoder(brut.replace(/\.svg$/, ''))

  if (!config) {
    return new Response('Configuration d’avatar invalide', { status: 400 })
  }

  const couches = CATEGORIES.map((cat) => {
    const atome = ATOMES[cat][config[cat]]
    const [x, y] = DECALAGES[cat]
    return `<g transform="translate(${x} ${y})">${atome.svg}</g>`
  }).join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CADRE}" width="256" height="256" role="img" aria-label="Avatar">` +
    `<g fill="none" fill-rule="evenodd">${couches}</g>` +
    `</svg>`

  return new Response(
    svg.replaceAll('currentColor', TRAIT).replaceAll('var(--peep-papier, #ffffff)', PAPIER),
    {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        // Le contenu est une pure fonction de l'URL : il ne changera jamais.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  )
}
