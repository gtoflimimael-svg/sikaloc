/**
 * Contrôle d'un fichier image avant traitement.
 *
 * L'extension et le `type` MIME déclaré par le navigateur viennent tous deux du
 * client : renommer `charge.exe` en `signature.png` suffit à les tromper. Le
 * seul juge fiable est le contenu — les premiers octets du fichier, que chaque
 * format image impose.
 *
 * Ce module tourne des deux côtés. Côté navigateur il fait gagner du temps à
 * l'utilisateur, en refusant tout de suite un fichier voué au rejet. Côté
 * serveur il fait autorité : un contrôle client se contourne en changeant deux
 * lignes de JavaScript, et le `type` porté par un `File` reçu en `FormData` est
 * une simple chaîne envoyée par le client — la croire reviendrait à croire
 * l'extension.
 */

/** 8 Mo : une photo de téléphone récent tient dessous, un PDF déguisé non. */
export const TAILLE_MAX = 8 * 1024 * 1024

/** Formats acceptés en entrée du détourage. */
export type FormatImage = 'png' | 'jpeg' | 'webp'

export class FichierRefuse extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FichierRefuse'
  }
}

/**
 * Signatures d'octets de tête. Un format se reconnaît à sa marque, pas à son nom.
 *
 * WebP a une particularité : `RIFF` occupe les octets 0-3, la taille les 4-7, et
 * `WEBP` les 8-11. Vérifier `RIFF` seul laisserait passer un fichier WAV.
 */
const MARQUES: { format: FormatImage; octets: number[]; decalage: number }[] = [
  { format: 'png', octets: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], decalage: 0 },
  { format: 'jpeg', octets: [0xff, 0xd8, 0xff], decalage: 0 },
  { format: 'webp', octets: [0x52, 0x49, 0x46, 0x46], decalage: 0 },
  { format: 'webp', octets: [0x57, 0x45, 0x42, 0x50], decalage: 8 },
]

/**
 * Lit les premiers octets et rend le format réel, ou `null` si aucun ne
 * correspond.
 */
export async function reconnaitreFormat(fichier: Blob): Promise<FormatImage | null> {
  const tete = new Uint8Array(await fichier.slice(0, 12).arrayBuffer())

  const correspond = (m: (typeof MARQUES)[number]) =>
    m.octets.every((o, i) => tete[m.decalage + i] === o)

  if (correspond(MARQUES[0])) return 'png'
  if (correspond(MARQUES[1])) return 'jpeg'
  // WebP exige les deux marques : `RIFF` en tête ET `WEBP` en position 8.
  if (correspond(MARQUES[2]) && correspond(MARQUES[3])) return 'webp'

  return null
}

/** Type MIME et extension correspondant à un format réellement reconnu. */
export const DESCRIPTION_FORMAT: Record<FormatImage, { type: string; extension: string }> = {
  png: { type: 'image/png', extension: 'png' },
  jpeg: { type: 'image/jpeg', extension: 'jpg' },
  webp: { type: 'image/webp', extension: 'webp' },
}

/**
 * Vérifie taille et format réel d'un fichier importé.
 *
 * @throws FichierRefuse avec un message destiné à l'utilisateur
 */
export async function verifierImage(fichier: File): Promise<FormatImage> {
  if (fichier.size === 0) {
    throw new FichierRefuse('Ce fichier est vide.')
  }

  if (fichier.size > TAILLE_MAX) {
    const mo = (fichier.size / (1024 * 1024)).toFixed(1)
    throw new FichierRefuse(
      `Ce fichier pèse ${mo} Mo, au-delà de la limite de 8 Mo. Réduisez la définition de la photo avant de l’importer.`,
    )
  }

  const format = await reconnaitreFormat(fichier)

  if (!format) {
    throw new FichierRefuse(
      'Ce fichier n’est pas une image PNG, JPEG ou WebP. Vérifiez que vous avez bien sélectionné une photo.',
    )
  }

  return format
}
