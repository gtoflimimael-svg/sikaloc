import { dictionary as motsCourants, adjacencyGraphs } from '@zxcvbn-ts/language-common'
import { dictionary as motsFrancais, translations } from '@zxcvbn-ts/language-fr'
import { ZxcvbnFactory, type OptionsType } from '@zxcvbn-ts/core'

import {
  contexteUtilisateur,
  interpreter,
  type ForceMotDePasse,
  type NiveauMotDePasse,
} from '@/lib/mot-de-passe'

/**
 * La mesure de robustesse elle-même — zxcvbn et ses dictionnaires.
 *
 * ─── Pourquoi ce module est séparé ─────────────────────────────────────────
 *
 * Les dictionnaires pèsent environ 1 Mo non compressé. Le serveur peut les
 * charger sans conséquence ; un bailleur qui ouvre `/connexion` depuis un
 * téléphone à Cotonou, non. `@/lib/mot-de-passe` reste donc sans dépendance, et
 * le navigateur ne vient chercher ce fichier-ci qu'au moment où quelqu'un
 * compose réellement un nouveau mot de passe — par `import()` dynamique dans
 * `champ-mot-de-passe.tsx`.
 *
 * C'est la réponse à l'objection, juste, qui avait écarté zxcvbn à l'origine :
 * son poids n'est un problème que s'il est payé par tout le monde, tout le temps.
 *
 * ─── Ce qui est mesuré ─────────────────────────────────────────────────────
 *
 * zxcvbn n'inspecte pas la forme du mot de passe mais le nombre d'essais qu'il
 * faudrait pour le trouver : mots des dictionnaires français et anglais,
 * prénoms et noms, mots de passe les plus fuités, dates, répétitions, suites,
 * substitutions en l33t (« M0tdep@sse »), et trajets de clavier — **azerty
 * compris**, ce qui compte pour un public francophone : « azerty123 » n'est une
 * suite que sur un clavier français.
 */

/**
 * Le moteur est construit une fois et réutilisé.
 *
 * Sa construction indexe les dictionnaires ; la refaire à chaque frappe
 * coûterait bien plus cher que la mesure elle-même.
 */
let moteur: ZxcvbnFactory | null = null

function obtenirMoteur(): ZxcvbnFactory {
  if (moteur) return moteur

  const options: OptionsType = {
    // L'ordre importe peu, les dictionnaires sont fusionnés par clé.
    dictionary: { ...motsCourants, ...motsFrancais },
    graphs: adjacencyGraphs,
    translations,
  }

  moteur = new ZxcvbnFactory(options)
  return moteur
}

/**
 * Part du mot de passe qu'un seul dictionnaire doit couvrir pour qu'on refuse,
 * quel que soit le score.
 *
 * La moitié suffit : « Sikaloc2026! » est à 58 % un nom de marque, le reste
 * n'est qu'une année. Au-dessous de ce seuil, un prénom noyé dans une chaîne
 * solide ne pénalise rien — « Moussa$K9pLvQ2wXz » reste un bon mot de passe.
 */
const PART_DEVINABLE_MAXIMALE = 0.5

/**
 * Part du mot de passe couverte par un dictionnaire donné.
 *
 * Rattrape deux angles morts du score zxcvbn, mesurés le 12/09/2026 :
 *
 *   « MoussaAdjovi1! » obtient **3**, alors que ses trois morceaux sont le
 *   prénom du bailleur, son nom, et deux caractères — 50 essais chacun. zxcvbn
 *   récompense le *nombre* de morceaux autant que leur solidité.
 *
 *   « Motdepass1E » obtient **2** alors qu'il est à 82 % un mot de passe fuité.
 *
 * On regarde donc ce que la séquence contient réellement, et non le seul score.
 */
function partCouverte(
  sequence: readonly unknown[],
  longueur: number,
  dictionnaire: string,
): number {
  if (longueur === 0) return 0

  let couverts = 0
  for (const element of sequence) {
    const morceau = element as { dictionaryName?: string; token?: string }
    if (morceau.dictionaryName === dictionnaire) {
      couverts += morceau.token?.length ?? 0
    }
  }

  return couverts / longueur
}

/**
 * Évalue un mot de passe, éventuellement au regard de ce qu'on sait du compte.
 *
 * `contexte` reçoit des valeurs non sensibles déjà saisies — nom, email,
 * téléphone — plus les termes propres à Sikaloc. zxcvbn les traite comme un
 * dictionnaire personnel : un mot de passe bâti sur le nom du bailleur ou sur
 * la marque s'effondre, ce qu'aucune règle de composition ne saurait voir.
 *
 * Rien n'est journalisé, rien n'est transmis : ni le mot de passe, ni le
 * contexte. Cette fonction est pure et tourne entièrement sur place.
 */
export function evaluerMotDePasse(valeur: string, contexte: string[] = []): ForceMotDePasse {
  if (valeur.length === 0) {
    return interpreter('', 0, null, [])
  }

  const resultat = obtenirMoteur().check(valeur, contexteUtilisateur(contexte))

  let score = resultat.score as NiveauMotDePasse
  let avertissement = resultat.feedback.warning || null
  let conseils = resultat.feedback.suggestions ?? []

  const partContexte = partCouverte(resultat.sequence, valeur.length, 'userInputs')
  const partFuitee = partCouverte(resultat.sequence, valeur.length, 'passwords-common')

  if (partContexte > PART_DEVINABLE_MAXIMALE || partFuitee > PART_DEVINABLE_MAXIMALE) {
    // Plafonné à « Faible », jamais forcé à 0 : la nuance entre « devinable »
    // et « parmi les dix premiers essayés » reste utile à qui corrige.
    score = Math.min(score, 1) as NiveauMotDePasse

    // Le contexte prime : c'est la cause la plus précise, et la seule que
    // zxcvbn ne sait pas toujours formuler. Sur un mot de passe seulement
    // répandu, son propre avertissement est déjà le bon — on le garde.
    if (partContexte > PART_DEVINABLE_MAXIMALE) {
      avertissement =
        'Ce mot de passe reprend des informations liées à votre compte ' +
        '— votre nom, votre email, ou le nom du service.'
      conseils = ['Choisissez des mots sans rapport avec vous ni avec Sikaloc.']
    } else if (!avertissement) {
      avertissement = 'Ce mot de passe figure parmi les plus utilisés.'
    }
  }

  return interpreter(valeur, score, avertissement, conseils)
}
