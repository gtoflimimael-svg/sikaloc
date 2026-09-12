/**
 * Robustesse d'un mot de passe — vocabulaire partagé client et serveur.
 *
 * ─── Ce que ce module contient, et ce qu'il ne contient pas ─────────────────
 *
 * Il ne contient **aucune** dépendance : ni zxcvbn, ni dictionnaire. C'est
 * délibéré. `champ-mot-de-passe.tsx` l'importe en valeur, donc tout ce qui
 * entre ici part dans le bundle de chaque page portant un champ mot de passe —
 * y compris `/connexion`, qui n'affiche aucune jauge.
 *
 * La mesure elle-même vit dans `@/lib/mot-de-passe-evaluation` : le serveur
 * l'importe normalement, le navigateur va la chercher à la demande.
 *
 * ─── Pourquoi la logique précédente a été retirée ───────────────────────────
 *
 * Elle comptait des classes de caractères — une majuscule, un chiffre, un
 * caractère spécial — et déclarait « Correct » tout ce qui cochait les cases.
 * Trois défauts mesurés le 12/09/2026 :
 *
 *   1. `Aaaaaaa1A`, `Trottoir9`, `Benin20266` étaient annoncés « Correct » et
 *      acceptés. Ils cochent les quatre cases et ne résistent à rien.
 *   2. `correct cheval batterie agrafe` — trente caractères, le type de mot de
 *      passe le plus solide qui soit — était classé « Faible » et **refusé**,
 *      faute de majuscule et de chiffre.
 *   3. `Ab1!cdefgh` était refusé et `Ab1!xyzwqr` accepté. Même forme, verdicts
 *      opposés : l'ancien détecteur cherchait quatre lettres consécutives de
 *      l'alphabet **n'importe où** dans la chaîne, si bien que tout mot de passe
 *      contenant « cdef », « mnop » ou « stuv » était rejeté.
 *
 * Compter des classes de caractères mesure la forme, pas la difficulté à
 * deviner. zxcvbn mesure la seconde, ce qui est la seule qui compte.
 */

/** Plancher de longueur. En deçà, aucun score ne rachète un mot de passe. */
export const LONGUEUR_MINIMALE = 8

/**
 * Limite de bcrypt, utilisé par GoTrue : au-delà, la fin du mot de passe serait
 * silencieusement ignorée — deux mots de passe différant après le 72ᵉ caractère
 * ouvriraient le même compte.
 */
export const LONGUEUR_MAXIMALE = 72

/**
 * Score zxcvbn minimal accepté par le serveur.
 *
 * 2 écarte tout ce qu'un attaquant essaie en premier — mots du dictionnaire,
 * prénoms, dates, suites de clavier, variations en l33t — sans exiger d'un
 * bailleur qu'il compose une chaîne illisible. Monter à 3 est une décision
 * produit, pas technique : il suffit de changer cette valeur, jauge et
 * validation suivent ensemble.
 */
export const SCORE_MINIMAL: NiveauMotDePasse = 2

export type NiveauMotDePasse = 0 | 1 | 2 | 3 | 4

/**
 * Termes que Sikaloc doit toujours considérer comme devinables.
 *
 * Ils sont passés à zxcvbn en entrées contextuelles, au même titre que le nom
 * du bailleur : un mot de passe bâti dessus est le premier qu'on essaie contre
 * ce produit précisément. Cette liste reprend celle de l'implémentation
 * précédente — c'est la seule partie qui méritait d'être gardée.
 */
export const TERMES_SIKALOC = [
  'sikaloc',
  'sika',
  'benin',
  'bénin',
  'cotonou',
  'porto-novo',
  'bailleur',
  'locataire',
  'loyer',
  'quittance',
]

/** Les cinq paliers de zxcvbn, nommés pour un bailleur. */
export const LIBELLES: Record<NiveauMotDePasse, string> = {
  0: 'Très faible',
  1: 'Faible',
  2: 'Moyen',
  3: 'Fort',
  4: 'Très fort',
}

export interface ForceMotDePasse {
  /** Le score zxcvbn, repris tel quel : la jauge ne réinterprète rien. */
  niveau: NiveauMotDePasse
  libelle: string
  /** Ce qui cloche, en une phrase. Traduit par `@zxcvbn-ts/language-fr`. */
  avertissement: string | null
  /** Comment faire mieux. Au plus deux, pour rester lisible. */
  conseils: string[]
  tropCourt: boolean
  tropLong: boolean
  /**
   * Vrai si le serveur acceptera ce mot de passe.
   *
   * Jauge et validation lisent le même champ : il ne peut pas y avoir de mot de
   * passe annoncé « Fort » puis refusé à l'envoi.
   */
  acceptable: boolean
}

/**
 * Assemble le verdict à partir d'un score zxcvbn brut.
 *
 * Séparée de la mesure pour que le serveur et le navigateur habillent le même
 * résultat de la même façon, sans que ce module ait à connaître zxcvbn.
 */
export function interpreter(
  valeur: string,
  score: NiveauMotDePasse,
  avertissement: string | null,
  conseils: string[],
): ForceMotDePasse {
  const tropCourt = valeur.length > 0 && valeur.length < LONGUEUR_MINIMALE
  const tropLong = valeur.length > LONGUEUR_MAXIMALE

  return {
    niveau: score,
    libelle: LIBELLES[score],
    avertissement,
    // Deux conseils suffisent : une liste de cinq ne se lit pas, elle décourage.
    conseils: conseils.slice(0, 2),
    tropCourt,
    tropLong,
    acceptable:
      valeur.length >= LONGUEUR_MINIMALE &&
      valeur.length <= LONGUEUR_MAXIMALE &&
      score >= SCORE_MINIMAL,
  }
}

/**
 * Message rendu par le serveur quand il refuse.
 *
 * Il dit ce qui bloque plutôt que d'énumérer des règles de composition — il n'y
 * en a plus. Un bailleur à qui l'on répond « il manque une majuscule » ajoute
 * une majuscule à la fin ; à qui l'on répond « ce mot de passe se devine », il
 * en change.
 */
export function messageRefus(force: ForceMotDePasse): string {
  if (force.tropCourt) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`
  }

  if (force.tropLong) {
    return `Le mot de passe ne peut pas dépasser ${LONGUEUR_MAXIMALE} caractères.`
  }

  const conseil = force.conseils[0]
  const constat =
    force.avertissement ?? 'Ce mot de passe est trop facile à deviner.'

  return conseil ? `${constat} ${conseil}` : constat
}

/**
 * Entrées contextuelles à pénaliser, nettoyées.
 *
 * zxcvbn traite ces valeurs comme des mots de dictionnaire : « Sikaloc2026 »
 * ou un mot de passe bâti sur le nom du bailleur tombent à un score très bas.
 *
 * L'email est découpé sur `@` : c'est la partie locale qui se retrouve dans les
 * mots de passe, pas le domaine. Rien de tout cela n'est transmis nulle part —
 * la mesure est locale, côté navigateur comme côté serveur.
 */
export function contexteUtilisateur(valeurs: (string | null | undefined)[]): string[] {
  const morceaux = new Set<string>(TERMES_SIKALOC)

  for (const valeur of valeurs) {
    const propre = valeur?.trim()
    if (!propre) continue

    morceaux.add(propre)

    // « moussa.k@exemple.bj » donne aussi « moussa.k », « moussa » et « k ».
    for (const part of propre.split(/[@\s._-]+/)) {
      if (part.length >= 3) morceaux.add(part)
    }
  }

  return [...morceaux]
}
