import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Font, Image } from '@react-pdf/renderer'

/**
 * Socle commun aux documents PDF : polices, palette et logo.
 *
 * Extrait de `document-quittance.tsx` le 24 août 2026, quand le guide destiné
 * aux prospects a eu besoin des mêmes fondations. Deux enregistrements de
 * polices dans deux modules finiraient par diverger — et une divergence de
 * police se voit à l'œil sur un document qu'un bailleur imprime.
 */

const DOSSIER_POLICES = join(process.cwd(), 'src/app/fonts')
const CHEMIN_LOGO_OFFICIEL = join(process.cwd(), 'public/marque/sikaloc-officiel-noir.svg')
const LOGO_OFFICIEL = readFileSync(CHEMIN_LOGO_OFFICIEL)
const RATIO_LOGO_OFFICIEL = 883 / 206

// L'enregistrement est mémoïsé au niveau du module : une fonction serverless
// réutilisée entre requêtes (Fluid Compute) ne doit pas ré-enregistrer les
// mêmes polices à chaque appel.
let policesEnregistrees = false

export function enregistrerPolices(): void {
  if (policesEnregistrees) return
  policesEnregistrees = true

  Font.register({
    family: 'Copernicus',
    fonts: [
      { src: join(DOSSIER_POLICES, 'Copernicus-Book.ttf'), fontWeight: 400 },
      { src: join(DOSSIER_POLICES, 'Copernicus-Bold.ttf'), fontWeight: 700 },
      { src: join(DOSSIER_POLICES, 'Copernicus-Extrabold.ttf'), fontWeight: 800 },
      { src: join(DOSSIER_POLICES, 'Copernicus-Heavy.ttf'), fontWeight: 900 },
    ],
  })

  Font.register({
    family: 'StyreneB',
    fonts: [
      { src: join(DOSSIER_POLICES, 'StyreneB-Regular.otf'), fontWeight: 400 },
      { src: join(DOSSIER_POLICES, 'StyreneB-Medium.otf'), fontWeight: 500 },
      { src: join(DOSSIER_POLICES, 'StyreneB-Bold.otf'), fontWeight: 700 },
    ],
  })
}

enregistrerPolices()

/**
 * Césure automatique désactivée.
 *
 * `@react-pdf/renderer` applique par défaut un algorithme anglophone qui coupe
 * les mots français à contretemps — « caract-ères », « l'émis-sion ». Sur un
 * document que le bailleur imprime et montre, cela se remarque. Le réglage est
 * global à la bibliothèque : il vaut pour la quittance comme pour le guide.
 */
Font.registerHyphenationCallback((mot) => [mot])

/** Palette des documents, alignée sur les jetons de `globals.css`. */
export const couleurs = {
  ink: '#111810',
  body: '#29352C',
  mute: '#5C675E',
  muteSoft: '#7B867D',
  primary: '#17311C',
  inkDeep: '#17311C',
  signature: '#B8F36D',
  canvasSoft: '#F6F8F5',
  hairline: '#DCE5DD',
  primaryPale: '#EAF1E7',
  warningPale: '#FAF0D4',
  warningContent: '#6B5210',
  warningDeep: '#8A5D00',
  positiveDeep: '#315D39',
}

/** Logotype officiel Sikaloc, chargé depuis l'asset vectoriel du kit de marque. */
export function LogoMarque({ hauteur = 17 }: { hauteur?: number }) {
  const largeur = Math.round(hauteur * RATIO_LOGO_OFFICIEL)

  return <Image src={LOGO_OFFICIEL} style={{ width: largeur, height: hauteur }} />
}
