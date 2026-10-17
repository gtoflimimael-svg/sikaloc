import 'server-only'

import sharp, { type Metadata, type OutputInfo } from 'sharp'

import { reconnaitreFormat } from '@/lib/signature/fichier'

/**
 * Traitement d'une photo d'annonce, avant tout stockage.
 *
 * ─── Pourquoi rien de l'original ne survit ─────────────────────────────────
 *
 * Une photo de téléphone porte souvent l'endroit exact où elle a été prise :
 * pour une photo de logement, c'est l'adresse que l'annonce s'interdit de
 * publier. Elle porte aussi le modèle de l'appareil, la date, parfois le nom
 * du propriétaire.
 *
 * L'original n'est donc jamais stocké. Ce module le décode, le redresse,
 * le réduit et le RÉ-ENCODE : ce qui sort est une image neuve, construite à
 * partir des seuls pixels. Sharp n'y recopie aucune métadonnée tant qu'on ne
 * le lui demande pas — et le résultat est relu pour le vérifier, plutôt que
 * de s'en remettre à ce comportement par défaut.
 *
 * ─── Ne pas reprendre le flux de la photo de profil ────────────────────────
 *
 * `televerserPhoto` (parametres.ts) stocke le fichier reçu tel quel, EXIF
 * compris. C'est sans conséquence tant que cette photo n'est servie qu'à son
 * propriétaire ; ce ne l'est plus pour une image destinée au public.
 *
 * ─── Toujours du JPEG en sortie ────────────────────────────────────────────
 *
 * JPEG et WebP sont acceptés en entrée ; tout ressort en JPEG. C'est le seul
 * format que tous les aperçus de lien — WhatsApp en tête, par où ces
 * annonces circuleront — affichent sans exception. Le schéma (S1) accepte
 * les deux types : il n'a pas besoin de changer.
 */

/** 3 Mio, en entrée comme en sortie. */
export const POIDS_MAX_PHOTO = 3 * 1024 * 1024

/** Le côté le plus long d'une photo stockée. Jamais d'agrandissement. */
export const COTE_MAX_PHOTO = 1600

/**
 * Le côté le plus court d'une photo stockée — la borne basse de
 * `annonce_photos_dimensions_bornes`. En deçà, rien n'est lisible.
 */
export const COTE_MIN_PHOTO = 200

/**
 * Au-delà, une image est refusée avant d'être décodée. 3 Mio de WebP uni
 * peuvent déclarer des dizaines de milliers de pixels de côté : décoder
 * d'abord et compter ensuite, ce serait laisser n'importe qui réserver la
 * mémoire du serveur. 50 millions couvre largement un capteur de téléphone.
 */
export const PIXELS_MAX_PHOTO = 50_000_000

/**
 * Qualités essayées dans l'ordre, jusqu'à passer sous la limite. 1600 px en
 * JPEG à 82 pèse quelques centaines de Ko : les deux suivantes sont un filet,
 * pas le cas courant. On ne descend pas plus bas — une photo de logement
 * illisible ne sert personne.
 */
const QUALITES = [82, 72, 62] as const

export type MotifRefusPhoto =
  | 'vide'
  | 'trop_lourde'
  | 'format'
  | 'illisible'
  | 'animee'
  | 'trop_grande'
  | 'trop_petite'
  | 'trop_lourde_apres'
  | 'metadonnees'

/** Un constat, puis quoi faire — le ton de `identite/regles.ts`. */
export const MESSAGES_PHOTO: Record<MotifRefusPhoto, string> = {
  vide: 'Ce fichier est vide.',
  trop_lourde: 'La photo dépasse 3 Mo. Choisissez une image plus légère.',
  format: 'Format non accepté. Utilisez une photo JPEG ou WebP.',
  illisible: 'Cette image est illisible ou endommagée. Choisissez-en une autre.',
  animee: 'Les images animées ne sont pas acceptées. Choisissez une photo fixe.',
  trop_grande: 'Cette image est trop grande pour être traitée. Réduisez-la avant de l’envoyer.',
  trop_petite: 'Cette photo est trop petite ou trop étroite : 200 pixels au moins de chaque côté, une fois réduite.',
  trop_lourde_apres: 'Cette photo reste trop lourde après réduction. Choisissez une image moins détaillée.',
  metadonnees: 'Cette photo n’a pas pu être nettoyée. Elle n’a pas été enregistrée.',
}

export type PhotoTraitee = {
  ok: true
  donnees: Buffer
  largeur: number
  hauteur: number
  poids: number
  typeMime: 'image/jpeg'
  extension: 'jpg'
}

export type PhotoRefusee = { ok: false; motif: MotifRefusPhoto; message: string }

const refus = (motif: MotifRefusPhoto): PhotoRefusee => ({
  ok: false,
  motif,
  message: MESSAGES_PHOTO[motif],
})

/**
 * Valide, redresse, réduit et ré-encode une photo.
 *
 * `poidsSortieMax` n'existe que pour éprouver le refus d'une sortie trop
 * lourde : aucune vraie photo de 1600 px ne l'atteint à 3 Mio.
 */
export async function traiterPhotoAnnonce(
  entree: Buffer,
  options: { poidsSortieMax?: number } = {},
): Promise<PhotoTraitee | PhotoRefusee> {
  const poidsSortieMax = options.poidsSortieMax ?? POIDS_MAX_PHOTO

  if (entree.length === 0) return refus('vide')
  if (entree.length > POIDS_MAX_PHOTO) return refus('trop_lourde')

  // Le format se juge aux octets de tête, jamais au type annoncé par le
  // navigateur. Puis Sharp doit le confirmer en le décodant.
  const marque = await reconnaitreFormat(new Blob([new Uint8Array(entree)]))
  if (marque !== 'jpeg' && marque !== 'webp') return refus('format')

  let meta: Metadata
  try {
    meta = await sharp(entree, { limitInputPixels: PIXELS_MAX_PHOTO }).metadata()
  } catch {
    return refus('illisible')
  }
  if (meta.format !== marque) return refus('format')
  if ((meta.pages ?? 1) > 1) return refus('animee')
  if (!meta.width || !meta.height) return refus('illisible')
  if (meta.width * meta.height > PIXELS_MAX_PHOTO) return refus('trop_grande')

  for (const qualite of QUALITES) {
    let sortie: { data: Buffer; info: OutputInfo }
    try {
      sortie = await sharp(entree, { limitInputPixels: PIXELS_MAX_PHOTO })
        // Redresser AVANT de jeter l'EXIF : c'est l'étiquette d'orientation
        // qui dit dans quel sens afficher les pixels. Retirée sans avoir été
        // appliquée, elle laisserait une photo couchée.
        .autoOrient()
        .resize({
          width: COTE_MAX_PHOTO,
          height: COTE_MAX_PHOTO,
          fit: 'inside',
          withoutEnlargement: true,
        })
        // Un WebP peut porter de la transparence ; le JPEG n'en a pas.
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: qualite, mozjpeg: true })
        .toBuffer({ resolveWithObject: true })
    } catch {
      return refus('illisible')
    }

    const { data, info } = sortie
    if (Math.min(info.width, info.height) < COTE_MIN_PHOTO) return refus('trop_petite')
    if (data.length > poidsSortieMax) continue

    // Ce qui sort est relu, pas supposé : aucune métadonnée ne doit y rester.
    const controle = await sharp(data).metadata()
    if (controle.exif || controle.xmp || controle.iptc || controle.orientation) {
      return refus('metadonnees')
    }

    return {
      ok: true,
      donnees: data,
      largeur: info.width,
      hauteur: info.height,
      poids: data.length,
      typeMime: 'image/jpeg',
      extension: 'jpg',
    }
  }

  return refus('trop_lourde_apres')
}
