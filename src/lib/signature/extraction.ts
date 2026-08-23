/**
 * Extraction d'une signature depuis une photo — traitement local, dans le
 * navigateur.
 *
 * Aucune image ne quitte l'appareil. Ce n'est pas un détail d'implémentation :
 * l'interface le promet au bailleur avant qu'il n'importe quoi que ce soit, et
 * ce qu'il importe peut être la photo d'un document entier.
 *
 * ─── Ce que cette version corrige ───────────────────────────────────────────
 *
 * La version précédente (`scan.ts`) travaillait en niveaux de gris sur l'image
 * entière, avec un masque binaire. Quatre défauts en découlaient :
 *
 *   1. Les paramètres d'échelle — rayon du seuillage `max(l,h)/24`, taille
 *      minimale des composantes `l×h/20000` — étaient calculés sur TOUTE
 *      l'image. Photographiez une feuille A4 : le rayon devient énorme et le
 *      dépoussiérage efface les traits fins de la signature elle-même. C'était
 *      la première cause de mauvaise qualité, et elle disparaît en recadrant
 *      AVANT de traiter.
 *   2. Le gris ignore la chrominance. Un stylo bleu clair a peu de contraste de
 *      luminance et beaucoup de contraste de couleur : il passait à travers.
 *   3. L'opacité venait d'un masque binaire, avec un plancher à 25 % : bords en
 *      escalier, trait découpé aux ciseaux plutôt qu'écrit.
 *   4. Rien ne retirait les lignes du papier réglé.
 *
 * ─── Filiation ─────────────────────────────────────────────────────────────
 *
 * La logique s'inspire de `signature-remove-bg` de F. Chaussin (MIT) :
 * seuil de luminosité BT.601, détection de l'encre bleue par dominance de
 * chrominance, renforcement du contraste, lissage des bords, suppression
 * morphologique des lignes. Son implémentation est en Python/OpenCV derrière
 * une API REST ; la logique est portée ici en TypeScript sur `Canvas`, sans
 * OpenCV — la morphologie tient en quelques dizaines de lignes sur un tableau
 * typé, là où OpenCV.js coûterait 8 à 10 Mo de téléchargement à un utilisateur
 * en 3G, et où un service distant briserait la promesse de traitement local.
 */

/**
 * Plafond de définition, appliqué APRÈS recadrage.
 *
 * Un recadrage serré sur une photo de 4000 px dépasse rarement ce plafond : il
 * ne mord donc qu'en cas de gros plan extrême, où la définition excédentaire
 * n'apporte plus rien. La consigne « ne pas réduire avant traitement » est
 * respectée : la réduction, quand elle a lieu, porte sur la zone utile.
 */
const COTE_MAX = 2600

/** En deçà, l'image est trop petite pour donner un résultat imprimable. */
const COTE_MIN_UTILE = 64

/** Sensibilité du seuillage adaptatif : un trait doit être plus sombre que son voisinage. */
const SENSIBILITE = 0.14

/** Marge conservée autour du trait, en proportion de la plus grande dimension. */
const MARGE = 0.05

/**
 * Douceur du bord.
 *
 * L'opacité suit une rampe continue autour du seuil local. `BORD_DOUX` déborde
 * volontairement AU-DESSUS du seuil : les pixels de bord d'un trait sont un peu
 * plus clairs que lui, et sans cette bande la transition s'arrêterait net à la
 * frontière du masque — bord dur, quelle que soit la finesse de la rampe.
 */
const RAMPE_PLEINE = 0.45
const BORD_DOUX = 0.10

export interface ResultatExtraction {
  /** PNG à fond transparent, prêt à téléverser. */
  fichier: File
  /** Aperçu affichable. */
  apercu: string
  largeur: number
  hauteur: number
  /** Ce que le traitement a reconnu — sert à expliquer un résultat décevant. */
  diagnostic: {
    encre: 'sombre' | 'bleue'
    /** Proportion de la zone couverte par le trait, en pourcentage. */
    couverture: number
    lignesRetirees: boolean
  }
}

/** Aucune trace exploitable n'a été trouvée. */
export class AucuneSignature extends Error {
  constructor(message?: string) {
    super(
      message ??
        'Aucun trait n’a été détecté. Recadrez plus près de la signature, ou reprenez la photo avec un meilleur éclairage.',
    )
    this.name = 'AucuneSignature'
  }
}

/** L'image est trop petite ou trop dégradée pour être exploitée. */
export class ImageInsuffisante extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageInsuffisante'
  }
}

/** Charge une image (fichier, blob ou data URI) dans un canvas hors écran. */
async function versCanvas(source: Blob | string): Promise<HTMLCanvasElement> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)

  try {
    const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const img = new Image()
      img.onload = () => resoudre(img)
      img.onerror = () => rejeter(new ImageInsuffisante('Image illisible ou format non reconnu.'))
      img.src = url
    })

    if (image.width < COTE_MIN_UTILE || image.height < COTE_MIN_UTILE) {
      throw new ImageInsuffisante(
        'La zone sélectionnée est trop petite. Recadrez une surface plus large autour de la signature.',
      )
    }

    const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * echelle))
    canvas.height = Math.max(1, Math.round(image.height * echelle))

    const contexte = canvas.getContext('2d', { willReadFrequently: true })
    if (!contexte) throw new ImageInsuffisante('Traitement d’image indisponible sur ce navigateur.')

    // Lissage de qualité : une réduction brute crée des marches d'escalier que
    // le seuillage prendrait ensuite pour du trait.
    contexte.imageSmoothingEnabled = true
    contexte.imageSmoothingQuality = 'high'
    contexte.drawImage(image, 0, 0, canvas.width, canvas.height)

    return canvas
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url)
  }
}

/** Image intégrale : somme cumulée, pour une moyenne locale en temps constant. */
function integrale(valeurs: Float32Array, l: number, h: number): Float64Array {
  const somme = new Float64Array((l + 1) * (h + 1))

  for (let y = 0; y < h; y++) {
    let ligne = 0
    for (let x = 0; x < l; x++) {
      ligne += valeurs[y * l + x]
      somme[(y + 1) * (l + 1) + (x + 1)] = somme[y * (l + 1) + (x + 1)] + ligne
    }
  }

  return somme
}

/**
 * Retire les taches isolées — grain du capteur, poussières, fragments de texte
 * coupés par le recadrage.
 *
 * Le seuil est relatif à la plus grande composante et non à la surface de
 * l'image : une signature occupe une portion très variable du cadre, et un
 * seuil absolu efface les traits fins dès que l'image est grande.
 */
function retirerTaches(masque: Uint8Array, l: number, h: number): void {
  const vu = new Uint8Array(l * h)
  const pile = new Int32Array(l * h)
  const composantes: number[][] = []

  for (let depart = 0; depart < masque.length; depart++) {
    if (!masque[depart] || vu[depart]) continue

    let sommet = 0
    const membres: number[] = []
    pile[sommet++] = depart
    vu[depart] = 1

    while (sommet > 0) {
      const p = pile[--sommet]
      membres.push(p)

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

    composantes.push(membres)
  }

  if (composantes.length === 0) return

  const plusGrande = composantes.reduce((m, c) => Math.max(m, c.length), 0)

  // 0,5 % de la composante principale : assez bas pour garder un point sur un
  // « i » ou un accent, assez haut pour écarter le grain.
  const minimum = Math.max(8, Math.round(plusGrande * 0.005))

  for (const membres of composantes) {
    if (membres.length < minimum) {
      for (const p of membres) masque[p] = 0
    }
  }
}

/**
 * Retire les lignes horizontales et verticales longues — papier réglé, quadrillé,
 * bord de tableau.
 *
 * Équivalent morphologique de l'ouverture par élément structurant linéaire
 * qu'`OpenCV` fournit, écrit ici directement : une ligne de papier traverse la
 * zone de part en part, une signature non. Le seuil est proportionnel à la
 * largeur du cadre, et la ligne n'est retirée que si elle est fine — sans quoi
 * un trait horizontal de la signature disparaîtrait avec.
 *
 * @returns true si au moins une ligne a été retirée.
 */
function retirerLignes(masque: Uint8Array, l: number, h: number): boolean {
  const aRetirer: number[] = []

  /**
   * Parcourt une rangée et retire les segments qui la traversent.
   *
   * Le comptage tolère les interruptions : une signature qui croise une ligne
   * de papier la coupe en deux tronçons, dont aucun n'atteint le seuil. Sans
   * cette tolérance, une ligne barrée par le trait survit — et elle élargit le
   * cadrage final bien au-delà de la signature.
   *
   * @param lire       accès au masque le long de la rangée
   * @param mesurer    épaisseur perpendiculaire à la position donnée
   * @param indice     position absolue dans le masque
   * @param longueur   nombre de cases de la rangée
   */
  function balayer(
    longueur: number,
    lire: (i: number) => boolean,
    mesurer: (i: number) => number,
    indice: (i: number) => number,
    longueurMin: number,
    epaisseurMax: number,
    trouMax: number,
  ): void {
    let debut = -1
    let fin = -1

    for (let i = 0; i <= longueur; i++) {
      const rempli = i < longueur && lire(i)

      if (rempli) {
        if (debut === -1) debut = i
        fin = i
        continue
      }

      // Fin possible du segment : on n'arrête qu'après un trou assez large,
      // pour ne pas scinder une ligne barrée par le trait.
      if (debut !== -1 && (i - fin > trouMax || i === longueur)) {
        const portee = fin - debut + 1
        if (portee >= longueurMin) {
          // Une vraie ligne est pleine sur presque toute sa portée. Sans ce
          // contrôle, la tolérance aux trous suffit à enchaîner du grain de
          // capteur en « ligne » sur une photo bruitée — et le retrait mord
          // alors dans la signature.
          let remplis = 0
          for (let j = debut; j <= fin; j++) if (lire(j)) remplis++

          const milieu = ((debut + fin) / 2) | 0
          if (remplis >= portee * 0.75 && mesurer(milieu) <= epaisseurMax) {
            for (let j = debut; j <= fin; j++) {
              if (lire(j)) aRetirer.push(indice(j))
            }
          }
        }
        debut = -1
        fin = -1
      }
    }
  }

  // ── Lignes horizontales ──────────────────────────────────────────────────
  const longueurMinH = Math.round(l * 0.5)
  const epaisseurMaxH = Math.max(2, Math.round(h * 0.02))
  const trouMaxH = Math.max(4, Math.round(l * 0.06))

  for (let y = 0; y < h; y++) {
    balayer(
      l,
      (x) => masque[y * l + x] === 1,
      (x) => {
        let e = 0
        for (let yy = y; yy < h && masque[yy * l + x]; yy++) e++
        for (let yy = y - 1; yy >= 0 && masque[yy * l + x]; yy--) e++
        return e
      },
      (x) => y * l + x,
      longueurMinH,
      epaisseurMaxH,
      trouMaxH,
    )
  }

  // ── Lignes verticales ────────────────────────────────────────────────────
  const longueurMinV = Math.round(h * 0.5)
  const epaisseurMaxV = Math.max(2, Math.round(l * 0.02))
  const trouMaxV = Math.max(4, Math.round(h * 0.06))

  for (let x = 0; x < l; x++) {
    balayer(
      h,
      (y) => masque[y * l + x] === 1,
      (y) => {
        let e = 0
        for (let xx = x; xx < l && masque[y * l + xx]; xx++) e++
        for (let xx = x - 1; xx >= 0 && masque[y * l + xx]; xx--) e++
        return e
      },
      (y) => y * l + x,
      longueurMinV,
      epaisseurMaxV,
      trouMaxV,
    )
  }

  for (const p of aRetirer) masque[p] = 0
  return aRetirer.length > 0
}

/**
 * Extrait le trait d'une image et rend un PNG transparent recadré.
 *
 * @param source image déjà recadrée sur la zone de signature
 */
export async function extraireSignature(source: Blob | string): Promise<ResultatExtraction> {
  const canvas = await versCanvas(source)
  const contexte = canvas.getContext('2d', { willReadFrequently: true })
  if (!contexte) throw new ImageInsuffisante('Traitement d’image indisponible sur ce navigateur.')

  const l = canvas.width
  const h = canvas.height
  const donnees = contexte.getImageData(0, 0, l, h).data

  /*
   * ── Carte d'encre ────────────────────────────────────────────────────────
   *
   * Deux mesures, dont on garde la plus parlante :
   *
   *   - la luminosité BT.601, qui repère l'encre sombre ;
   *   - la dominance bleue `bleu − (rouge + vert)/2`, qui repère l'encre bleue
   *     même quand elle est claire. Un stylo bille bleu délavé peut être aussi
   *     lumineux que le papier ombré : seule la couleur le distingue.
   *
   * On produit une image « d'encre » où sombre = trait, quel que soit le motif
   * qui l'a révélé. Le seuillage adaptatif travaille ensuite dessus.
   */
  const encre = new Float32Array(l * h)
  const bleute = new Uint8Array(l * h)

  for (let i = 0, p = 0; i < donnees.length; i += 4, p++) {
    const r = donnees[i]
    const v = donnees[i + 1]
    const b = donnees[i + 2]

    const luminosite = 0.299 * r + 0.587 * v + 0.114 * b
    const dominanceBleue = b - (r + v) / 2

    // La dominance est ramenée à l'échelle de la luminosité : une dominance de
    // 60 vaut un assombrissement de 60 points.
    const parLaCouleur = 255 - Math.max(0, dominanceBleue) * 2.2

    if (dominanceBleue > 18) bleute[p] = 1

    encre[p] = Math.min(luminosite, parLaCouleur)
  }

  // ── Seuillage adaptatif (Bradley) ────────────────────────────────────────
  // Le rayon suit la zone recadrée, pas la photo d'origine : c'est ce qui
  // rendait l'ancienne version inutilisable sur une photo de document.
  const somme = integrale(encre, l, h)
  const rayon = Math.max(6, Math.round(Math.max(l, h) / 28))
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

      if (encre[p] < seuil) masque[p] = 1

      // Rampe continue : c'est elle qui donne un bord d'encre plutôt qu'une
      // découpe. Calculée pour tous les pixels, y compris hors masque.
      const plein = seuil * (1 - RAMPE_PLEINE)
      const vide = seuil * (1 + BORD_DOUX)
      const brut = (vide - encre[p]) / Math.max(1, vide - plein)
      intensite[p] = brut <= 0 ? 0 : brut >= 1 ? 1 : brut
    }
  }

  const lignesRetirees = retirerLignes(masque, l, h)
  retirerTaches(masque, l, h)

  // ── Recadrage sur le trait ───────────────────────────────────────────────
  let minX = l
  let minY = h
  let maxX = -1
  let maxY = -1
  let pixelsEncre = 0
  let pixelsBleus = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (!masque[y * l + x]) continue
      pixelsEncre++
      if (bleute[y * l + x]) pixelsBleus++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0) throw new AucuneSignature()

  const couverture = (pixelsEncre / (l * h)) * 100

  // L'encre est dite bleue si le TRAIT lui-même est majoritairement bleuté —
  // mesuré sur le masque, seul endroit où la question a un sens. Comparer des
  // pixels bleus à une somme de luminosité sur toute l'image, comme le faisait
  // une version précédente, revient à comparer un compte à une intégrale : le
  // drapeau ne se levait jamais.
  const encreBleue = pixelsBleus > pixelsEncre * 0.4

  // Une image quasi entièrement « encrée » n'est pas une signature : c'est une
  // photo trop sombre, ou un fond pris pour du trait. Mieux vaut le dire que
  // rendre un rectangle noir.
  if (couverture > 45) {
    throw new AucuneSignature(
      'L’image est trop sombre ou trop contrastée pour isoler un trait. Reprenez la photo avec un éclairage plus uniforme, sans ombre portée.',
    )
  }

  const marge = Math.round(Math.max(maxX - minX, maxY - minY) * MARGE) + 4
  minX = Math.max(0, minX - marge)
  minY = Math.max(0, minY - marge)
  maxX = Math.min(l - 1, maxX + marge)
  maxY = Math.min(h - 1, maxY + marge)

  const largeur = maxX - minX + 1
  const hauteur = maxY - minY + 1

  if (largeur < 16 || hauteur < 8) {
    throw new AucuneSignature(
      'Le trait détecté est trop petit pour être exploité. Recadrez au plus près de la signature.',
    )
  }

  /*
   * ── Zone peinte ──────────────────────────────────────────────────────────
   *
   * Élargie d'un pixel autour du masque NETTOYÉ. Les pixels de bord d'un trait
   * sont plus clairs que le seuil, donc hors masque : sans cette dilatation, la
   * rampe d'opacité s'arrêterait net et le bord resterait dur. Partir du masque
   * nettoyé évite qu'une poussière écartée ne revienne par son halo.
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

  // ── Composition du PNG transparent ───────────────────────────────────────
  const sortie = document.createElement('canvas')
  sortie.width = largeur
  sortie.height = hauteur
  const contexteSortie = sortie.getContext('2d')
  if (!contexteSortie) throw new ImageInsuffisante('Traitement d’image indisponible sur ce navigateur.')

  const image = contexteSortie.createImageData(largeur, hauteur)

  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      const src = (y + minY) * l + (x + minX)
      if (!zone[src]) continue

      const opacite = intensite[src]
      if (opacite <= 0) continue

      const cible = (y * largeur + x) * 4

      // Encre d'un noir légèrement bleuté : à l'impression, un noir pur sur
      // fond crème donne un trait plus dur que l'original au stylo.
      image.data[cible] = 19
      image.data[cible + 1] = 19
      image.data[cible + 2] = 26
      image.data[cible + 3] = Math.round(255 * opacite)
    }
  }

  contexteSortie.putImageData(image, 0, 0)

  const blob = await new Promise<Blob | null>((resoudre) => sortie.toBlob(resoudre, 'image/png'))
  if (!blob) throw new ImageInsuffisante('Conversion PNG impossible.')

  return {
    fichier: new File([blob], 'signature.png', { type: 'image/png' }),
    apercu: sortie.toDataURL('image/png'),
    largeur,
    hauteur,
    diagnostic: {
      encre: encreBleue ? 'bleue' : 'sombre',
      couverture: Math.round(couverture * 10) / 10,
      lignesRetirees,
    },
  }
}
