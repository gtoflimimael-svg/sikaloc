import * as faceapi from '@vladmandic/face-api'

import { COTE_MINIMAL, type MesuresVisage } from '@/lib/identite/regles'

/**
 * Adaptateur de vision — `@vladmandic/face-api`, volet qualité.
 *
 * Il ne rend que des **mesures** : combien de visages, où, de quelle taille, et
 * la netteté de l'image. Le jugement appartient à `regles.ts`, qui n'a jamais
 * entendu parler de face-api. C'est ce qui rend le moteur remplaçable.
 *
 * ─── Pourquoi TinyFaceDetector ──────────────────────────────────────────────
 *
 * face-api propose SSD MobileNet (~5,4 Mo) et TinyFaceDetector (~190 Ko). Pour
 * compter des visages sur un portrait et mesurer leur emprise, le second suffit
 * largement et se télécharge trente fois plus vite. Sur un téléphone en 3G, la
 * différence n'est pas une optimisation, c'est la différence entre un écran qui
 * répond et un écran qu'on abandonne.
 *
 * ─── Les modèles sont servis par Sikaloc ────────────────────────────────────
 *
 * `public/modeles/visage/`, pas un CDN. La CSP du projet pose `connect-src
 * 'self'` : un chargement distant serait bloqué, et c'est une bonne chose —
 * l'analyse d'un visage n'a aucune raison d'annoncer son existence à un tiers.
 */

/** Où `npm run preparer:modeles` dépose les poids du détecteur. */
const DOSSIER_MODELES = '/modeles/visage'

/** Côté maximal donné au détecteur. Au-delà, on paie du temps pour rien. */
const COTE_ANALYSE = 640

let chargement: Promise<void> | null = null

/**
 * Charge le détecteur une fois, et une seule.
 *
 * La promesse est mémorisée plutôt qu'un drapeau booléen : deux appels
 * rapprochés — un changement de fichier pendant que le premier charge — doivent
 * attendre le même chargement, pas en lancer deux.
 */
function chargerDetecteur(): Promise<void> {
  chargement ??= faceapi.nets.tinyFaceDetector.loadFromUri(DOSSIER_MODELES)
  return chargement
}

/**
 * Décode le fichier en canvas, borné.
 *
 * Une photo de téléphone fait couramment 4000 px de côté : la détecter à cette
 * taille coûte plusieurs secondes sans rien apporter. On réduit, et les mesures
 * sont ensuite ramenées au repère de l'image d'origine.
 */
async function versCanvas(
  fichier: File,
): Promise<{ canvas: HTMLCanvasElement; largeur: number; hauteur: number; echelle: number }> {
  const url = URL.createObjectURL(fichier)

  try {
    const image = new Image()
    await new Promise<void>((resoudre, rejeter) => {
      image.onload = () => resoudre()
      image.onerror = () => rejeter(new Error('image illisible'))
      image.src = url
    })

    const largeur = image.naturalWidth
    const hauteur = image.naturalHeight
    if (!largeur || !hauteur) throw new Error('image sans dimensions')

    const echelle = Math.min(1, COTE_ANALYSE / Math.max(largeur, hauteur))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(largeur * echelle)
    canvas.height = Math.round(hauteur * echelle)

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('canvas indisponible')
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    return { canvas, largeur, hauteur, echelle }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Netteté, par variance du laplacien.
 *
 * Un noyau 3×3 sur la luminance : une image nette a des transitions franches,
 * donc une forte variance ; une image floue les a lissées. C'est grossier, et
 * c'est voulu — on cherche à écarter le flou franc, pas à noter un objectif.
 */
function mesurerNettete(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d')
  if (!ctx) return Number.POSITIVE_INFINITY

  const { width: L, height: H } = canvas
  if (L < 3 || H < 3) return Number.POSITIVE_INFINITY

  const { data } = ctx.getImageData(0, 0, L, H)
  const gris = new Float32Array(L * H)
  for (let i = 0; i < L * H; i++) {
    const p = i * 4
    gris[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
  }

  let somme = 0
  let sommeCarres = 0
  let n = 0

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < L - 1; x++) {
      const i = y * L + x
      const l =
        4 * gris[i] - gris[i - 1] - gris[i + 1] - gris[i - L] - gris[i + L]
      somme += l
      sommeCarres += l * l
      n++
    }
  }

  if (n === 0) return Number.POSITIVE_INFINITY
  const moyenne = somme / n
  return sommeCarres / n - moyenne * moyenne
}

/**
 * Mesure les visages d'une photo.
 *
 * Rien n'est journalisé, rien n'est transmis : ni l'image, ni les positions.
 * La fonction rend ses mesures à l'appelant et oublie tout le reste.
 */
export async function mesurer(fichier: File): Promise<MesuresVisage> {
  const { canvas, largeur, hauteur, echelle } = await versCanvas(fichier)

  // Image trop petite : inutile de charger 1,4 Mo de modèle pour le constater.
  if (largeur < COTE_MINIMAL || hauteur < COTE_MINIMAL) {
    return { largeurImage: largeur, hauteurImage: hauteur, visages: [] }
  }

  await chargerDetecteur()

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.35,
  })
  const detections = await faceapi.detectAllFaces(canvas, options)

  return {
    largeurImage: largeur,
    hauteurImage: hauteur,
    nettete: mesurerNettete(canvas),
    // Les boîtes sont rendues dans le repère du canvas réduit : on les ramène à
    // celui de l'image d'origine, qui est celui des règles.
    visages: detections.map((d) => ({
      x: d.box.x / echelle,
      y: d.box.y / echelle,
      largeur: d.box.width / echelle,
      hauteur: d.box.height / echelle,
      confiance: d.score,
    })),
  }
}
