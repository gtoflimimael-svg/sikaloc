import { join } from 'node:path'

import { Font, G, Path, Svg } from '@react-pdf/renderer'

import {
  COULEUR_MARQUE,
  HAUTEUR_MARQUE,
  LARGEUR_MARQUE,
  RATIO_MARQUE,
  TRACES_ICONE,
  TRACES_TEXTE,
  TRANSFORM_ICONE,
} from '@/lib/marque'

/**
 * Socle commun aux documents PDF : polices, palette et logo.
 *
 * Extrait de `document-quittance.tsx` le 24 août 2026, quand le guide destiné
 * aux prospects a eu besoin des mêmes fondations. Deux enregistrements de
 * polices dans deux modules finiraient par diverger — et une divergence de
 * police se voit à l'œil sur un document qu'un bailleur imprime.
 */

const DOSSIER_POLICES = join(process.cwd(), 'src/app/fonts')

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
  ink: '#131314',
  body: '#3A3A3D',
  mute: '#64646C',
  muteSoft: '#82828E',
  primary: '#5555BC',
  inkDeep: '#3E3EA9',
  canvasSoft: '#F4F4FB',
  hairline: '#D8D8E6',
  primaryPale: '#DEDEEF',
  warningPale: '#FAF0D4',
  warningContent: '#6B5210',
  warningDeep: '#A37B12',
  positiveDeep: '#2F6B3F',
}

/** Logo vectoriel de la marque, à la hauteur demandée. */
export function LogoMarque({ hauteur = 17 }: { hauteur?: number }) {
  const largeur = Math.round(hauteur * RATIO_MARQUE)

  return (
    <Svg width={largeur} height={hauteur} viewBox={`0 0 ${LARGEUR_MARQUE} ${HAUTEUR_MARQUE}`}>
      <G transform={TRANSFORM_ICONE} fill={COULEUR_MARQUE}>
        {TRACES_ICONE.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </G>
      {TRACES_TEXTE.map(({ transform, d }, i) => (
        <G key={i} transform={transform} fill={COULEUR_MARQUE}>
          <Path d={d} />
        </G>
      ))}
    </Svg>
  )
}
