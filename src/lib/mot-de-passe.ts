/**
 * Robustesse d'un mot de passe — critères partagés client et serveur.
 *
 * Le même module sert la jauge affichée pendant la frappe et la validation
 * Zod : un indicateur qui dirait « fort » à propos d'un mot de passe que le
 * serveur refuse serait pire que pas d'indicateur du tout.
 *
 * Volontairement sans dépendance : zxcvbn pèse 400 Ko une fois chargé, ce qui
 * n'a pas de sens sur une page d'inscription consultée depuis un mobile
 * béninois. On mesure quatre exigences et deux bonus, ce qui suffit à écarter
 * « azerty123 » sans prétendre à une entropie exacte.
 */

export const LONGUEUR_MINIMALE = 8
export const LONGUEUR_CONFORTABLE = 12

export interface Critere {
  cle: string
  libelle: string
  /** Un critère obligatoire bloque l'enregistrement ; les autres nourrissent la jauge. */
  obligatoire: boolean
  satisfait: (valeur: string) => boolean
}

/**
 * Les grands classiques, en clair ou à peine déguisés. La liste est courte à
 * dessein : elle attrape les mots de passe qu'un attaquant essaie en premier,
 * pas ceux qu'un dictionnaire complet trouverait.
 */
const COURANTS = [
  'password', 'motdepasse', 'azerty', 'qwerty', 'sikaloc', 'benin', 'cotonou',
  'admin', 'bailleur', 'loyer', 'bonjour', 'welcome', 'iloveyou', 'soleil',
]

const SEQUENCES = [
  '0123456789', 'abcdefghijklmnopqrstuvwxyz', 'azertyuiop', 'qwertyuiop',
]

export const CRITERES: Critere[] = [
  {
    cle: 'longueur',
    libelle: `${LONGUEUR_MINIMALE} caractères minimum`,
    obligatoire: true,
    satisfait: (v) => v.length >= LONGUEUR_MINIMALE,
  },
  {
    cle: 'minuscule',
    libelle: 'Une lettre minuscule',
    obligatoire: true,
    satisfait: (v) => /[a-zà-öø-ÿ]/.test(v),
  },
  {
    cle: 'majuscule',
    libelle: 'Une lettre majuscule',
    obligatoire: true,
    satisfait: (v) => /[A-ZÀ-ÖØ-Þ]/.test(v),
  },
  {
    cle: 'chiffre',
    libelle: 'Un chiffre',
    obligatoire: true,
    satisfait: (v) => /\d/.test(v),
  },
  {
    cle: 'special',
    libelle: 'Un caractère spécial (!, ?, @, #…)',
    obligatoire: false,
    satisfait: (v) => /[^\p{L}\p{N}]/u.test(v),
  },
  {
    cle: 'longueurConfortable',
    libelle: `${LONGUEUR_CONFORTABLE} caractères ou plus`,
    obligatoire: false,
    satisfait: (v) => v.length >= LONGUEUR_CONFORTABLE,
  },
]

/** Un mot de passe trop deviné : présent tel quel dans la liste ou en séquence. */
export function estPrevisible(valeur: string): boolean {
  const nu = valeur.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (nu.length === 0) return false

  // On ne rejette que si le mot courant PORTE le mot de passe : « Sikaloc2026! »
  // est prévisible, « MonSikalocPersonnel8! » ne l'est pas.
  if (COURANTS.some((mot) => nu.startsWith(mot) && nu.length <= mot.length + 4)) {
    return true
  }

  if (/^(.)\1+$/.test(nu)) return true

  return SEQUENCES.some((suite) => {
    for (let i = 0; i + 4 <= suite.length; i++) {
      if (nu.includes(suite.slice(i, i + 4))) return true
    }
    return false
  })
}

export type NiveauMotDePasse = 0 | 1 | 2 | 3 | 4

export interface ForceMotDePasse {
  niveau: NiveauMotDePasse
  libelle: string
  /** Critères obligatoires non satisfaits, dans l'ordre d'affichage. */
  manquants: string[]
  previsible: boolean
  /** Vrai si le serveur acceptera ce mot de passe. */
  acceptable: boolean
}

const LIBELLES: Record<NiveauMotDePasse, string> = {
  0: 'Très faible',
  1: 'Faible',
  2: 'Correct',
  3: 'Solide',
  4: 'Excellent',
}

export function evaluer(valeur: string): ForceMotDePasse {
  const manquants = CRITERES.filter((c) => c.obligatoire && !c.satisfait(valeur)).map(
    (c) => c.cle,
  )
  const previsible = estPrevisible(valeur)
  const satisfaits = CRITERES.filter((c) => c.satisfait(valeur)).length

  let niveau: NiveauMotDePasse
  if (valeur.length === 0) niveau = 0
  else if (manquants.length > 0) niveau = satisfaits >= 3 ? 1 : 0
  else if (previsible) niveau = 1
  else if (satisfaits === CRITERES.length && valeur.length >= 14) niveau = 4
  else if (satisfaits >= 5) niveau = 3
  else niveau = 2

  return {
    niveau,
    libelle: LIBELLES[niveau],
    manquants,
    previsible,
    acceptable: manquants.length === 0 && !previsible,
  }
}
