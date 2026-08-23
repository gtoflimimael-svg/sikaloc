/**
 * Détourage d'une signature photographiée — traitement local, dans le
 * navigateur.
 *
 * Une photo de signature prise au téléphone arrive avec le papier jauni, une
 * ombre en diagonale et la moitié du bureau autour. Collée telle quelle sur une
 * quittance, elle donne un rectangle gris au milieu du document. Ce module en
 * extrait le trait et rend un PNG à fond transparent, recadré.
 *
 * Tout se passe côté client : la photo ne quitte l'appareil que déjà nettoyée,
 * ce qui évite d'envoyer sur le réseau une image du bureau du bailleur.
 *
 * Le seuillage est adaptatif (méthode de Bradley) : un seuil global échouerait
 * exactement là où ces photos échouent, c'est-à-dire quand un bord de la page
 * est plus sombre que l'autre.
 */

/**
 * Largeur maximale conservée.
 *
 * 1600 auparavant. Un téléphone photographie en 3000-4000 px : à 1600, une
 * signature cadrée de loin ne conservait qu'une centaine de pixels de haut une
 * fois recadrée — trop peu pour une impression propre. Le seuillage est
 * linéaire en nombre de pixels, le surcoût reste de quelques dizaines de
 * millisecondes.
 */
const LARGEUR_MAX = 2400

/** Sensibilité du seuillage : un trait doit être 15 % plus sombre que son voisinage. */
const SENSIBILITE = 0.15

/** Marge laissée autour du trait, en proportion de la plus grande dimension. */
const MARGE = 0.04

/**
 * Douceur du bord du trait.
 *
 * L'ancienne version peignait un masque binaire, puis forçait une opacité
 * minimale de 25 % : 87 % des pixels d'encre sortaient à opacité maximale et le
 * trait avait des bords en escalier — découpé aux ciseaux plutôt qu'écrit.
 *
 * L'opacité suit maintenant une rampe continue autour du seuil local :
 *   - au-dessous de `seuil × (1 − RAMPE_PLEINE)`, l'encre est pleine ;
 *   - au-dessus de `seuil × (1 + BORD_DOUX)`, elle est transparente ;
 *   - entre les deux, elle s'interpole.
 *
 * `BORD_DOUX` déborde volontairement au-dessus du seuil : sans cette bande, la
 * transition s'arrêterait net à la frontière du masque et le bord resterait
 * dur, quelle que soit la finesse de la rampe.
 */
const RAMPE_PLEINE = 0.35
const BORD_DOUX = 0.06

export interface ResultatScan {
  /** PNG à fond transparent, prêt à téléverser. */
  fichier: File
  /** Aperçu affichable. */
  apercu: string
  largeur: number
  hauteur: number
}

export class ScanVide extends Error {
  constructor() {
    super(
      'Aucun trait n’a été détecté. Cadrez la signature de plus près, sur une feuille bien éclairée.',
    )
    this.name = 'ScanVide'
  }
}

/** Charge une image (fichier ou data URI) dans un canvas hors écran. */
async function versCanvas(source: Blob | string): Promise<HTMLCanvasElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)

  try {
    const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const img = new Image()
      img.onload = () => resoudre(img)
      img.onerror = () => rejeter(new Error('Image illisible.'))
      img.src = url
    })

    const echelle = Math.min(1, LARGEUR_MAX / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * echelle))
    canvas.height = Math.max(1, Math.round(image.height * echelle))

    const contexte = canvas.getContext('2d')
    if (!contexte) throw new Error('Canvas indisponible.')

    contexte.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}

/** Image intégrale : somme cumulée, pour une moyenne locale en temps constant. */
function integrale(gris: Float32Array, l: number, h: number): Float64Array {
  const somme = new Float64Array((l + 1) * (h + 1))

  for (let y = 0; y < h; y++) {
    let ligne = 0
    for (let x = 0; x < l; x++) {
      ligne += gris[y * l + x]
      somme[(y + 1) * (l + 1) + (x + 1)] = somme[y * (l + 1) + (x + 1)] + ligne
    }
  }

  return somme
}

/**
 * Retire les taches isolées — grains du capteur, poussières, lignes de cahier
 * coupées par le cadrage. Sans ce passage, un scan pris au flash sort constellé
 * de points noirs.
 */
function retirerTaches(masque: Uint8Array, l: number, h: number, minimum: number): void {
  const vu = new Uint8Array(l * h)
  const pile = new Int32Array(l * h)
  const composante = new Int32Array(l * h)

  for (let depart = 0; depart < masque.length; depart++) {
    if (!masque[depart] || vu[depart]) continue

    let sommet = 0
    let taille = 0
    pile[sommet++] = depart
    vu[depart] = 1

    while (sommet > 0) {
      const p = pile[--sommet]
      composante[taille++] = p

      const x = p % l
      const y = (p / l) | 0

      // 8-connexité : un trait fin traverse souvent en diagonale.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= l || ny >= h) continue
          const voisin = ny * l + nx
          if (masque[voisin] && !vu[voisin]) {
            vu[voisin] = 1
            pile[sommet++] = voisin
          }
        }
      }
    }

    if (taille < minimum) {
      for (let i = 0; i < taille; i++) masque[composante[i]] = 0
    }
  }
}

/**
 * Extrait le trait d'une photo et rend un PNG transparent recadré.
 *
 * @param source photo (fichier ou data URI issue de la caméra)
 */
export async function detourerSignature(source: Blob | string): Promise<ResultatScan> {
  const canvas = await versCanvas(source)
  const contexte = canvas.getContext('2d')
  if (!contexte) throw new Error('Canvas indisponible.')

  const l = canvas.width
  const h = canvas.height
  const pixels = contexte.getImageData(0, 0, l, h)
  const donnees = pixels.data

  // ── Niveaux de gris ──────────────────────────────────────────────────────
  const gris = new Float32Array(l * h)
  for (let i = 0, p = 0; i < donnees.length; i += 4, p++) {
    gris[p] = 0.299 * donnees[i] + 0.587 * donnees[i + 1] + 0.114 * donnees[i + 2]
  }

  // ── Seuillage adaptatif ──────────────────────────────────────────────────
  const somme = integrale(gris, l, h)
  const rayon = Math.max(8, Math.round(Math.max(l, h) / 24))
  const masque = new Uint8Array(l * h)
  const intensite = new Float32Array(l * h)

  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - rayon)
    const y2 = Math.min(h - 1, y + rayon)

    for (let x = 0; x < l; x++) {
      const x1 = Math.max(0, x - rayon)
      const x2 = Math.min(l - 1, x + rayon)
      const compte = (x2 - x1 + 1) * (y2 - y1 + 1)

      const total =
        somme[(y2 + 1) * (l + 1) + (x2 + 1)] -
        somme[y1 * (l + 1) + (x2 + 1)] -
        somme[(y2 + 1) * (l + 1) + x1] +
        somme[y1 * (l + 1) + x1]

      const seuil = (total / compte) * (1 - SENSIBILITE)
      const p = y * l + x

      // Le masque reste binaire : il sert à décider quelles composantes garder
      // et où recadrer. L'opacité, elle, est continue — c'est ce qui donne au
      // trait un bord d'encre plutôt qu'une découpe.
      if (gris[p] < seuil) masque[p] = 1

      const plein = seuil * (1 - RAMPE_PLEINE)
      const vide = seuil * (1 + BORD_DOUX)
      const brut = (vide - gris[p]) / Math.max(1, vide - plein)
      intensite[p] = brut <= 0 ? 0 : brut >= 1 ? 1 : brut
    }
  }

  retirerTaches(masque, l, h, Math.max(12, Math.round((l * h) / 20000)))

  /*
   * Les pixels du bord du trait sont, par définition, un peu plus clairs que le
   * seuil : ils ne sont donc PAS dans le masque. Les peindre suppose d'élargir
   * la zone d'un pixel autour de ce qui a survécu au dépoussiérage — sans quoi
   * la rampe d'opacité s'arrêterait net à la frontière du masque et le bord
   * resterait aussi dur qu'avant.
   *
   * La dilatation part du masque nettoyé, pas du masque brut : une poussière
   * déjà écartée ne doit pas revenir par son halo.
   */
  const zone = new Uint8Array(l * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (!masque[y * l + x]) continue
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= l || ny >= h) continue
          zone[ny * l + nx] = 1
        }
      }
    }
  }

  // ── Recadrage sur le trait ───────────────────────────────────────────────
  let minX = l
  let minY = h
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (!masque[y * l + x]) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) throw new ScanVide()

  const marge = Math.round(Math.max(maxX - minX, maxY - minY) * MARGE) + 4
  minX = Math.max(0, minX - marge)
  minY = Math.max(0, minY - marge)
  maxX = Math.min(l - 1, maxX + marge)
  maxY = Math.min(h - 1, maxY + marge)

  const largeur = maxX - minX + 1
  const hauteur = maxY - minY + 1

  // ── Composition du PNG transparent ───────────────────────────────────────
  const sortie = document.createElement('canvas')
  sortie.width = largeur
  sortie.height = hauteur
  const contexteSortie = sortie.getContext('2d')
  if (!contexteSortie) throw new Error('Canvas indisponible.')

  const image = contexteSortie.createImageData(largeur, hauteur)

  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const source = (y + minY) * l + (x + minX)
      const cible = (y * largeur + x) * 4

      if (!zone[source]) continue

      const opacite = intensite[source]
      if (opacite <= 0) continue

      // Encre d'un noir légèrement bleuté : à l'impression, un noir pur sur
      // fond crème donne un trait plus dur que l'original au stylo.
      image.data[cible] = 19
      image.data[cible + 1] = 19
      image.data[cible + 2] = 26
      // Plus de plancher d'opacité : c'est lui qui rendait chaque bord abrupt.
      image.data[cible + 3] = Math.round(255 * opacite)
    }
  }

  contexteSortie.putImageData(image, 0, 0)

  const blob = await new Promise<Blob | null>((resoudre) =>
    sortie.toBlob(resoudre, 'image/png'),
  )

  if (!blob) throw new Error('Conversion PNG impossible.')

  return {
    fichier: new File([blob], 'signature.png', { type: 'image/png' }),
    apercu: sortie.toDataURL('image/png'),
    largeur,
    hauteur,
  }
}
