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
  racine: string
  /** Ce qu'on y fait, pour la page de choix. */
  actions: string[]
}

export const ESPACE_PRO: Espace = {
  role: 'bailleur',
  nom: 'Sikaloc_Pro',
  titre: 'Propriétaire ou bailleur',
  description: 'Gérez vos biens, vos locataires et vos loyers.',
  racine: '/app',
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
  if (roles.estBailleur && !roles.estLocataire) return ESPACE_PRO.racine
  if (roles.estLocataire && !roles.estBailleur) return ESPACE_ME.racine
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
