import { CATEGORIES, NB_OPTIONS, type Categorie } from '@/lib/avatar/tailles'

export type { Categorie }
export { CATEGORIES, NB_OPTIONS }

/** Un avatar = un index par catégorie. */
export type ConfigAvatar = Record<Categorie, number>

/**
 * Encodage compact et stable : `tenue-coiffure-visage-pilosite-accessoire`.
 * C'est ce qui est stocké en base et ce qui sert de segment d'URL — d'où le
 * choix de chiffres et de tirets uniquement.
 */
export function encoder(c: ConfigAvatar): string {
  return CATEGORIES.map((cat) => c[cat]).join('-')
}

/** Tolérant par construction : une valeur illisible retombe sur 0. */
export function decoder(valeur: string | null | undefined): ConfigAvatar | null {
  if (!valeur) return null
  const parts = valeur.split('-')
  if (parts.length !== CATEGORIES.length) return null
  const config = {} as ConfigAvatar
  for (const [i, cat] of CATEGORIES.entries()) {
    const n = Number(parts[i])
    if (!Number.isInteger(n) || n < 0 || n >= NB_OPTIONS[cat]) return null
    config[cat] = n
  }
  return config
}

/**
 * FNV-1a 32 bits — petit, sans dépendance, et surtout *stable* : le même
 * identifiant donne toujours le même avatar, sur toutes les machines et entre
 * deux déploiements. C'est ce qui permet de ne rien stocker tant que
 * l'utilisateur n'a pas personnalisé le sien.
 */
function empreinte(graine: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < graine.length; i++) {
    h ^= graine.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Avatar déterministe dérivé d'un identifiant (id de bailleur ou de locataire). */
export function depuisIdentifiant(id: string): ConfigAvatar {
  const config = {} as ConfigAvatar
  let h = empreinte(id)
  for (const cat of CATEGORIES) {
    config[cat] = h % NB_OPTIONS[cat]
    // On rebrasse entre deux catégories, sinon des index voisins se corrèlent.
    h = Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0
  }
  return config
}

/** Avatar au hasard — utilisé par le bouton « Au hasard ». */
export function auHasard(): ConfigAvatar {
  const config = {} as ConfigAvatar
  for (const cat of CATEGORIES) {
    config[cat] = Math.floor(Math.random() * NB_OPTIONS[cat])
  }
  return config
}

/**
 * Résout ce qu'il faut afficher : la personnalisation si elle existe et qu'elle
 * est valide, sinon un avatar dérivé de l'identifiant. Aucune ligne existante
 * n'a donc besoin d'être remplie en base.
 */
export function resoudre(id: string, avatar: string | null | undefined): ConfigAvatar {
  return decoder(avatar) ?? depuisIdentifiant(id)
}

/** URL de la route de rendu. */
export function urlAvatar(id: string, avatar?: string | null): string {
  return `/avatar/${encoder(resoudre(id, avatar))}.svg`
}
