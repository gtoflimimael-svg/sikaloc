/**
 * Les deux espaces de Sikaloc, et qui va où.
 *
 * Fichier pur : aucune dépendance, aucun accès réseau. Le navigateur et le
 * serveur appliquent donc exactement la même règle d'aiguillage.
 *
 * ─── Une marque, deux espaces ───────────────────────────────────────────────
 *
 *     Sikaloc            la marque mère
 *       ├── Sikaloc_Pro   le bailleur gère ses biens
 *       └── Sikaloc_Me    le locataire consulte le sien
 *
 * Ce ne sont pas deux applications : c'est un seul produit, un seul jeu de
 * données, deux points de vue. Un bail vu depuis Pro et vu depuis Me est le
 * même bail — pas une copie synchronisée.
 */

export type Role = 'bailleur' | 'locataire'

export interface Roles {
  estBailleur: boolean
  estLocataire: boolean
}

export const AUCUN_ROLE: Roles = { estBailleur: false, estLocataire: false }

export interface Espace {
  role: Role
  /** Le nom affiché. Le souligné fait partie de la marque. */
  nom: string
  titre: string
  description: string
  /**
   * Le segment qui délimite l'espace — ce qui sert à RECONNAÎTRE un chemin.
   *
   * Lu par `espaceDuChemin` et `cheminProtege`. Ce n'est pas une destination :
   * `/pro` est devenu la page de présentation de Sikaloc_Pro, qui s'adresse à
   * quelqu'un qui n'a pas de compte.
   */
  racine: string
  /**
   * Où entre quelqu'un qui a le droit d'entrer — ce qui sert à ENVOYER.
   *
   * Les deux notions coïncidaient tant que `/pro` était le tableau de bord.
   * Elles ont divergé, et les confondre renverrait un bailleur qui vient de se
   * connecter sur une page de vente.
   */
  tableauDeBord: string
  /** Ce qu'on y fait, pour la page de choix. */
  actions: string[]
}

export const ESPACE_PRO: Espace = {
  role: 'bailleur',
  nom: 'Sikaloc_Pro',
  titre: 'Propriétaire ou bailleur',
  description: 'Gérez vos biens, vos locataires et vos loyers.',
  racine: '/pro',
  tableauDeBord: '/pro/tableau-de-bord',
  actions: [
    'Logements, locataires et baux',
    'Paiements et quittances',
    'Loyers en retard et relances',
  ],
}

export const ESPACE_ME: Espace = {
  role: 'locataire',
  nom: 'Sikaloc_Me',
  titre: 'Locataire',
  description: 'Retrouvez votre logement, vos loyers et vos quittances.',
  racine: '/me',
  // Les deux coïncident encore ici : `/me` est le tableau de bord du
  // locataire. Elles divergeront le jour où `/me` recevra sa présentation.
  tableauDeBord: '/me',
  actions: [
    'Votre logement et votre bail',
    'Vos loyers et vos paiements',
    'Vos quittances, à télécharger',
  ],
}

export const ESPACES: Espace[] = [ESPACE_PRO, ESPACE_ME]

export function espace(role: Role): Espace {
  return role === 'bailleur' ? ESPACE_PRO : ESPACE_ME
}

/**
 * Où envoyer quelqu'un qui vient de se connecter.
 *
 * ─── Le cas des deux rôles ──────────────────────────────────────────────────
 *
 * Quelqu'un qui possède un logement et en loue un autre a les deux rôles, et
 * c'est une situation ordinaire — pas un cas limite à interdire. On ne choisit
 * pas pour lui : on lui pose la question. Deviner l'enverrait une fois sur deux
 * au mauvais endroit, et c'est précisément ce que la page de choix évite.
 *
 * Un compte sans aucun rôle ne devrait pas exister. Si cela arrive — un
 * locataire inscrit dont l'invitation n'a pas abouti — la page de choix est
 * encore le meilleur endroit : elle explique les deux espaces au lieu de
 * renvoyer vers une erreur.
 */
export function destinationApresConnexion(roles: Roles): string {
  // `tableauDeBord` et non `racine` : `/pro` est une page de vente désormais,
  // et y renvoyer quelqu'un qui vient de se connecter serait absurde.
  if (roles.estBailleur && !roles.estLocataire) return ESPACE_PRO.tableauDeBord
  if (roles.estLocataire && !roles.estBailleur) return ESPACE_ME.tableauDeBord
  return '/entrer'
}

/** L'espace auquel appartient un chemin, ou `null` pour le site public. */
export function espaceDuChemin(chemin: string): Espace | null {
  if (chemin === ESPACE_ME.racine || chemin.startsWith(`${ESPACE_ME.racine}/`)) {
    return ESPACE_ME
  }
  if (chemin === ESPACE_PRO.racine || chemin.startsWith(`${ESPACE_PRO.racine}/`)) {
    return ESPACE_PRO
  }
  return null
}

/** A-t-on le droit d'entrer dans cet espace ? */
export function accesAutorise(roles: Roles, espaceVise: Espace): boolean {
  return espaceVise.role === 'bailleur' ? roles.estBailleur : roles.estLocataire
}

/**
 * Les chemins publics situés À L'INTÉRIEUR d'un espace protégé.
 *
 * ─── Pourquoi cette liste existe ────────────────────────────────────────────
 *
 * `/me` est réservé aux comptes authentifiés. Mais deux de ses pages
 * s'adressent précisément à quelqu'un qui n'a PAS de compte :
 *
 *     /me/rejoindre            explique comment obtenir un accès
 *     /me/invitation/<jeton>   le lien reçu par email, et le formulaire
 *                              de création de compte
 *
 * Les protéger les rend inatteignables pour leur seul public, et renvoie vers
 * un écran de connexion sans identifiants.
 *
 * ─── L'oubli que cette règle a coûté ───────────────────────────────────────
 *
 * `/me/invitation` manquait. Un locataire qui cliquait le lien reçu de son
 * bailleur atterrissait sur la connexion : le parcours d'invitation était coupé
 * à son avant-dernier pas, pour ceux-là mêmes à qui il s'adresse.
 *
 * Invisible depuis le code — la page est écrite pour un visiteur anonyme et le
 * dit — parce que le proxy l'arrêtait avant elle. Il a fallu ouvrir un vrai
 * lien dans un navigateur sans session.
 *
 * ─── Pourquoi c'est sans danger ────────────────────────────────────────────
 *
 * Aucune de ces pages ne rend de donnée sans autorisation propre. Pour
 * l'invitation, le jeton EST l'autorisation : la page recalcule son empreinte
 * et refuse tout ce qui ne correspond pas. Une route publique n'est jamais une
 * permission ; elle décide seulement qui a le droit de frapper à la porte.
 */
export const CHEMINS_PUBLICS: string[] = ['/me/rejoindre', '/me/invitation']

/**
 * Les chemins publics dont SEUL le chemin exact l'est.
 *
 * ─── Pourquoi une seconde liste, et pas une entrée de plus ci-dessus ────────
 *
 * `CHEMINS_PUBLICS` ouvre un chemin ET tous ses descendants — c'est ce qu'il
 * faut pour `/me/invitation/<jeton>`, dont le jeton est un segment enfant.
 *
 * `/pro` demande exactement l'inverse. La page de présentation s'adresse à
 * quelqu'un qui n'a pas de compte ; tout ce qui vit dessous — `/pro/baux`,
 * `/pro/paiements`, `/pro/tableau-de-bord` — reste l'application du bailleur.
 * Ajouter `/pro` à la liste par préfixe ouvrirait l'espace entier, en une
 * ligne, sans que rien ne le signale.
 *
 * D'où deux listes plutôt qu'un drapeau : la différence de comportement se lit
 * dans le nom.
 */
export const CHEMINS_PUBLICS_EXACTS: string[] = ['/pro']

/** Ce chemin échappe-t-il à la protection de son espace ? */
export function cheminPublic(chemin: string): boolean {
  if (CHEMINS_PUBLICS_EXACTS.includes(chemin)) return true
  return CHEMINS_PUBLICS.some((p) => chemin === p || chemin.startsWith(`${p}/`))
}

/**
 * Ce chemin appartient-il à un espace réservé aux comptes authentifiés ?
 *
 * ─── Pourquoi la comparaison est faite PAR SEGMENT ──────────────────────────
 *
 * Le proxy comparait par simple `startsWith`. Avec l'ancien préfixe `/app`,
 * c'était sans conséquence : aucune route publique ne commençait par ces
 * quatre lettres.
 *
 * `/pro` n'a pas cette chance. `startsWith('/pro')` capture `/profil`,
 * `/professionnel`, `/probleme` — et les enverrait tous vers l'écran de
 * connexion. Le jour où une de ces adresses existe, la panne serait invisible
 * au développeur connecté, et totale pour le visiteur.
 *
 * On exige donc le séparateur, ou l'égalité exacte : `/pro` et `/pro/baux`
 * sont gardés, `/profil` ne l'est pas.
 *
 * ─── Ce que cette fonction ne décide pas ────────────────────────────────────
 *
 * Elle dit quels chemins réclament une session, pas qui a le droit d'entrer.
 * L'appartenance à un espace se vérifie ailleurs, sur le serveur, après la
 * session — une route gardée n'est pas une autorisation.
 */
export function cheminProtege(chemin: string): boolean {
  return ESPACES.some(
    ({ racine }) => chemin === racine || chemin.startsWith(`${racine}/`),
  )
}
