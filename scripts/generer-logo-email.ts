/**
 * Rasterise le logo Sikaloc en PNG pour les emails.
 *
 *   npx tsx scripts/generer-logo-email.ts
 *
 * Les clients email (Gmail, Outlook…) n'ont pas un support fiable du SVG
 * inline dans un `<img>` — Outlook l'ignore purement et simplement. Le PDF et
 * le web peuvent rester vectoriels (`@react-pdf/renderer`, SVG natif), mais
 * l'email a besoin d'un bitmap. Écrit dans `public/marque/logo-email.png`,
 * servi tel quel par Next.js et référencé par une URL absolue dans
 * `src/lib/emails.ts`.
 *
 * Rendu à 3x la taille d'affichage (fond transparent) pour rester net sur
 * écran Retina ; regénérer ce fichier si les tracés de `src/lib/marque.ts`
 * changent.
 */

import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import sharp from 'sharp'

const HAUTEUR_AFFICHAGE = 28
const ECHELLE = 3
const RATIO_MARQUE = 883 / 206

async function main() {
  const hauteur = HAUTEUR_AFFICHAGE * ECHELLE
  const largeur = Math.round(hauteur * RATIO_MARQUE)

  // Source unique : tracés validés du kit officiel, jamais reconstitués en police.
  const svg = await readFile(join(process.cwd(), 'public/marque/sikaloc-officiel-noir.svg'))
  const destination = join(process.cwd(), 'public/marque/logo-email.png')

  await mkdir(dirname(destination), { recursive: true })

  await sharp(svg, { density: 300 })
    .resize(largeur, hauteur)
    .png({ compressionLevel: 9 })
    .toFile(destination)

  console.log(`✓ ${destination} (${largeur}×${hauteur}, affiché à ${HAUTEUR_AFFICHAGE}px de haut)`)
}

main().catch((erreur) => {
  console.error(erreur)
  process.exit(1)
})
