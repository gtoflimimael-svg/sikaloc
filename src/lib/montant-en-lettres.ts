/**
 * Conversion d'un montant en toutes lettres (français standard).
 *
 * La quittance béninoise exige la mention du montant « en lettres et en
 * chiffres » (spec §6.1.10). Écrit sans dépendance : le rendu PDF tourne en
 * serverless et une librairie de plus s'y paie en cold start.
 *
 * Orthographe appliquée :
 *   - « vingt » et « cent » prennent un s quand ils sont multipliés et ne sont
 *     suivis d'aucun autre adjectif numéral : quatre-vingts, deux cents ;
 *   - ils le perdent devant « mille », qui est un adjectif numéral :
 *     quatre-vingt mille, deux cent mille ;
 *   - ils le gardent devant « million » et « milliard », qui sont des noms :
 *     deux cents millions ;
 *   - « mille » est invariable.
 */

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit',
  'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
]

const DIZAINES = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', '',
  'quatre-vingt', '',
]

/** 0 à 99. */
function sousCent(n: number): string {
  if (n < 17) return UNITES[n]
  if (n < 20) return `dix-${UNITES[n - 10]}`

  const dizaine = Math.floor(n / 10)
  const unite = n % 10

  // 70–79 et 90–99 se construisent sur soixante et quatre-vingt.
  if (dizaine === 7 || dizaine === 9) {
    const base = dizaine === 7 ? 'soixante' : 'quatre-vingt'
    if (dizaine === 7 && unite === 1) return 'soixante et onze'
    return `${base}-${sousCent(10 + unite)}`
  }

  if (unite === 0) return dizaine === 8 ? 'quatre-vingts' : DIZAINES[dizaine]
  if (unite === 1 && dizaine !== 8) return `${DIZAINES[dizaine]} et un`

  return `${DIZAINES[dizaine]}-${UNITES[unite]}`
}

/** 0 à 999. */
function sousMille(n: number): string {
  if (n < 100) return sousCent(n)

  const centaine = Math.floor(n / 100)
  const reste = n % 100
  const prefixe = centaine === 1 ? 'cent' : `${UNITES[centaine]} cent`

  if (reste === 0) return centaine === 1 ? 'cent' : `${UNITES[centaine]} cents`

  return `${prefixe} ${sousCent(reste)}`
}

/** Retire l'accord de « vingts » / « cents » devant « mille ». */
function sansAccordFinal(mots: string): string {
  return mots.replace(/(vingt|cent)s$/, '$1')
}

const ECHELLES = [
  { valeur: 1_000_000_000, singulier: 'milliard', pluriel: 'milliards' },
  { valeur: 1_000_000, singulier: 'million', pluriel: 'millions' },
  { valeur: 1_000, singulier: 'mille', pluriel: 'mille' },
] as const

/**
 * `montantEnLettres(150000)` → « cent cinquante mille »
 *
 * Les décimales sont ignorées : le franc CFA n'a pas de sous-unité en
 * circulation, et une quittance ne mentionne jamais de centimes.
 */
export function montantEnLettres(montant: number | string | null | undefined): string {
  const valeur = Math.abs(Math.round(Number(montant ?? 0)))

  if (!Number.isFinite(valeur)) return 'zéro'
  if (valeur === 0) return 'zéro'

  const parties: string[] = []
  let reste = valeur

  for (const echelle of ECHELLES) {
    const quotient = Math.floor(reste / echelle.valeur)
    if (quotient === 0) continue

    if (echelle.valeur === 1_000) {
      parties.push(
        quotient === 1 ? 'mille' : `${sansAccordFinal(sousMille(quotient))} mille`,
      )
    } else {
      const nom = quotient > 1 ? echelle.pluriel : echelle.singulier
      parties.push(`${sousMille(quotient)} ${nom}`)
    }

    reste %= echelle.valeur
  }

  if (reste > 0) parties.push(sousMille(reste))

  return parties.join(' ')
}

/** Variante capitalisée, pour ouvrir la mention de décharge. */
export function montantEnLettresCapitalise(montant: number | string | null | undefined): string {
  const mots = montantEnLettres(montant)
  return mots.charAt(0).toUpperCase() + mots.slice(1)
}
