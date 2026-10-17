import { LIBELLES_EQUIPEMENT } from '@/lib/annonces/libelles'
import { formaterFCFA } from '@/lib/format'
import { EQUIPEMENTS_ANNONCE, TYPES_LOGEMENT, type EquipementAnnonce, type TypeLogement } from '@/lib/types/database'

/**
 * Les filtres de Sikaloc_Find, lus dans l'URL.
 *
 * ─── Une seule règle pour les valeurs douteuses ────────────────────────────
 *
 * Un paramètre inconnu, vide, répété, hors bornes ou illisible est IGNORÉ —
 * jamais transmis à la base, jamais transformé en erreur. La recherche
 * s'exécute avec les filtres qui restent, et les pastilles affichent
 * exactement ce qui a été appliqué : personne ne croit chercher ce qu'il ne
 * cherche pas.
 *
 * `page` est la seule exception, et elle appartient à S5 : elle décrit la
 * position dans les résultats, pas un critère. Une page qui n'en est pas une
 * répond 404.
 *
 * ─── L'ordre des paramètres ────────────────────────────────────────────────
 *
 * Toutes les URL fabriquées ici suivent le même ordre, quelle que soit celle
 * qui a été reçue : deux recherches identiques s'écrivent pareil. Rien n'est
 * redirigé pour autant — une URL tapée à la main dans un autre ordre reste
 * valable, et les fiches filtrées portent de toute façon `noindex` et une
 * canonique vers `/find`.
 */

export type Filtres = {
  ville?: string
  quartier?: string
  type?: TypeLogement
  loyerMin?: number
  loyerMax?: number
  chambres?: number
  surfaceMin?: number
  surfaceMax?: number
  /** « maintenant » : disponible aujourd'hui, ou sans date annoncée. */
  disponible?: boolean
  equipements: EquipementAnnonce[]
}

export type ParametresBruts = Record<string, string | string[] | undefined>

const LONGUEUR_MAX = 120

/** Un paramètre répété ne vaut rien : on ne devine pas lequel comptait. */
function valeur(brut: string | string[] | undefined): string | null {
  if (typeof brut !== 'string') return null
  const propre = brut.trim()
  return propre.length > 0 && propre.length <= LONGUEUR_MAX ? propre : null
}

function entier(brut: string | string[] | undefined, min: number, max: number): number | undefined {
  const v = valeur(brut)
  if (v === null || !/^\d{1,9}$/.test(v)) return undefined
  const n = Number(v)
  return n >= min && n <= max ? n : undefined
}

export function lireFiltres(parametres: ParametresBruts): Filtres {
  const type = valeur(parametres.type)
  // Deux écritures acceptées, et une seule produite : le formulaire envoie
  // `equipements=parking&equipements=gardien` (comportement natif des cases à
  // cocher), nos liens écrivent `equipements=parking,gardien`. C'est la seule
  // exception à « un paramètre répété est ignoré » : ici, la répétition dit
  // précisément ce qu'elle veut dire.
  const bruts = parametres.equipements
  const equipements = (Array.isArray(bruts) ? bruts : [bruts ?? ''])
    .flatMap((e) => String(e).split(','))
    .map((e) => e.trim())
    .filter((e): e is EquipementAnnonce => (EQUIPEMENTS_ANNONCE as readonly string[]).includes(e))

  return {
    ville: valeur(parametres.ville) ?? undefined,
    quartier: valeur(parametres.quartier) ?? undefined,
    type: type && (TYPES_LOGEMENT as string[]).includes(type) ? (type as TypeLogement) : undefined,
    loyerMin: entier(parametres.loyer_min, 0, 999_999_999),
    loyerMax: entier(parametres.loyer_max, 0, 999_999_999),
    chambres: entier(parametres.chambres, 0, 20),
    surfaceMin: entier(parametres.surface_min, 0, 2000),
    surfaceMax: entier(parametres.surface_max, 0, 2000),
    disponible: valeur(parametres.disponible) === 'maintenant' ? true : undefined,
    equipements: [...new Set(equipements)],
  }
}

export const aucunFiltre = (f: Filtres): boolean =>
  !f.ville &&
  !f.quartier &&
  !f.type &&
  f.loyerMin === undefined &&
  f.loyerMax === undefined &&
  f.chambres === undefined &&
  f.surfaceMin === undefined &&
  f.surfaceMax === undefined &&
  !f.disponible &&
  f.equipements.length === 0

/** Ce que la fonction SQL attend. Les filtres absents valent NULL. */
export function argumentsRecherche(f: Filtres, limite: number, decalage: number) {
  return {
    p_ville: f.ville ?? null,
    p_quartier: f.quartier ?? null,
    p_type: f.type ?? null,
    p_loyer_min: f.loyerMin ?? null,
    p_loyer_max: f.loyerMax ?? null,
    p_chambres: f.chambres ?? null,
    p_surface_min: f.surfaceMin ?? null,
    p_surface_max: f.surfaceMax ?? null,
    p_disponible: f.disponible ?? null,
    p_equipements: f.equipements.length > 0 ? f.equipements : null,
    p_limite: limite,
    p_decalage: decalage,
  }
}

/** L'URL d'une recherche. Ordre fixe, valeurs vides omises. */
export function urlRecherche(f: Filtres, page = 1): string {
  const p = new URLSearchParams()
  if (f.ville) p.set('ville', f.ville)
  if (f.quartier) p.set('quartier', f.quartier)
  if (f.type) p.set('type', f.type)
  if (f.loyerMin !== undefined) p.set('loyer_min', String(f.loyerMin))
  if (f.loyerMax !== undefined) p.set('loyer_max', String(f.loyerMax))
  if (f.chambres !== undefined) p.set('chambres', String(f.chambres))
  if (f.surfaceMin !== undefined) p.set('surface_min', String(f.surfaceMin))
  if (f.surfaceMax !== undefined) p.set('surface_max', String(f.surfaceMax))
  if (f.disponible) p.set('disponible', 'maintenant')
  if (f.equipements.length > 0) p.set('equipements', f.equipements.join(','))
  if (page > 1) p.set('page', String(page))
  const requete = p.toString()
  return requete ? `/find?${requete}` : '/find'
}

export type Pastille = { cle: string; libelle: string; href: string }

/**
 * Les filtres actifs, chacun avec l'URL qui le retire.
 *
 * Retirer un filtre ramène à la page 1 : la page 3 d'une recherche n'a aucun
 * sens pour une recherche plus large.
 */
export function pastilles(f: Filtres): Pastille[] {
  const sans = (modifications: Partial<Filtres>) => urlRecherche({ ...f, ...modifications })
  const liste: Pastille[] = []

  if (f.ville) liste.push({ cle: 'ville', libelle: f.ville, href: sans({ ville: undefined }) })
  if (f.quartier) liste.push({ cle: 'quartier', libelle: f.quartier, href: sans({ quartier: undefined }) })
  if (f.type) liste.push({ cle: 'type', libelle: f.type, href: sans({ type: undefined }) })
  if (f.loyerMin !== undefined) {
    liste.push({ cle: 'loyer_min', libelle: `à partir de ${formaterFCFA(f.loyerMin)}`, href: sans({ loyerMin: undefined }) })
  }
  if (f.loyerMax !== undefined) {
    liste.push({ cle: 'loyer_max', libelle: `jusqu’à ${formaterFCFA(f.loyerMax)}`, href: sans({ loyerMax: undefined }) })
  }
  if (f.chambres !== undefined) {
    liste.push({
      cle: 'chambres',
      libelle: f.chambres === 0 ? 'Entrer-coucher' : `${f.chambres} chambre${f.chambres > 1 ? 's' : ''}`,
      href: sans({ chambres: undefined }),
    })
  }
  if (f.surfaceMin !== undefined) {
    liste.push({ cle: 'surface_min', libelle: `à partir de ${f.surfaceMin} m²`, href: sans({ surfaceMin: undefined }) })
  }
  if (f.surfaceMax !== undefined) {
    liste.push({ cle: 'surface_max', libelle: `jusqu’à ${f.surfaceMax} m²`, href: sans({ surfaceMax: undefined }) })
  }
  if (f.disponible) {
    liste.push({ cle: 'disponible', libelle: 'Disponible maintenant', href: sans({ disponible: undefined }) })
  }
  for (const e of f.equipements) {
    liste.push({
      cle: `equipement-${e}`,
      libelle: LIBELLES_EQUIPEMENT[e],
      href: urlRecherche({ ...f, equipements: f.equipements.filter((x) => x !== e) }),
    })
  }

  return liste
}
