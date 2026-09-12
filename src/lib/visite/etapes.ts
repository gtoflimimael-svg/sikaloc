import type { ProgressionVisite } from '@/lib/types/database'

/**
 * Le scénario de la visite guidée.
 *
 * ─── Ce qui change par rapport au didacticiel ───────────────────────────────
 *
 * Le didacticiel décrivait l'interface, écran par écran, et se franchissait au
 * bouton « Suivant ». Ici, chaque étape attend une **action réelle** et ne se
 * valide que lorsque la donnée existe. On ne peut pas « passer » l'ajout d'un
 * logement : il faut en ajouter un.
 *
 * ─── Pourquoi la réussite se lit dans les données, et non dans la page ──────
 *
 * Trois pistes ont été écartées, chacune pour une raison mesurée :
 *
 *   • la route ne prouve rien. `/app/logements` est la destination du succès,
 *     mais aussi celle d'« Annuler », du lien de la barre latérale et du retour
 *     arrière. Et au plafond du plan Gratuit, `/app/logements/nouveau` répond
 *     200 sans contenir le moindre formulaire.
 *
 *   • l'événement DOM ment. `bailleurAvecEcriture()` peut refuser l'écriture
 *     pendant le cycle de grâce : un `submit` réussi n'est pas une création.
 *
 *   • l'état local ne survit pas. Le composant est démonté à chaque navigation,
 *     et le parcours consiste précisément à naviguer.
 *
 * Les compteurs, eux, disent la vérité et survivent à tout — rafraîchissement,
 * fermeture du navigateur, changement d'appareil — sans rien persister.
 *
 * ─── Le ton ────────────────────────────────────────────────────────────────
 *
 * Messages courts, à l'impératif, deuxième personne. On décrit ce qu'il y a à
 * faire, jamais ce que le produit garantit. Pas de promesse de conformité.
 */

export interface Etape {
  /** Identifiant stable. Sert de clé de rendu et de repère dans les bancs. */
  cle: string
  /** Nom de l'étape dans la liste de progression. Deux mots, pas une phrase. */
  jalon: string
  titre: string
  /** Une à deux phrases. Ce qui doit être fait, et pourquoi ça compte. */
  message: string
  /**
   * Valeur de `data-visite` à éclairer.
   *
   * Absente, ou introuvable à l'écran : la bulle se centre plutôt que de
   * pointer dans le vide. L'étape n'est jamais sautée pour autant.
   */
  cible?: string
  /** Raccourci proposé dans la bulle, quand l'endroit à atteindre est ailleurs. */
  lien?: { libelle: string; href: string }
  /**
   * Préfixes de route où l'action se fait réellement.
   *
   * Y être change tout : désigner l'entrée de menu qui a mené ici n'apprend
   * plus rien, et la bulle posée à côté d'elle vient recouvrir le formulaire —
   * le banc l'a prise en flagrant délit sur le bouton « Créer le logement ».
   * Sur ces routes, la visite s'écarte dans un coin et rend la main.
   */
  routesAction?: string[]
  /**
   * L'étape est-elle accomplie ?
   *
   * Lue dans les compteurs réels. Une étape déjà accomplie avant que la visite
   * ne la demande — un bailleur qui explore seul — est simplement franchie.
   */
  accomplie: (p: ProgressionVisite) => boolean
}

export const ETAPES: Etape[] = [
  {
    cle: 'logement',
    routesAction: ['/app/logements/nouveau'],
    jalon: 'Logement',
    titre: 'Commencez par un logement',
    message:
      'Un logement, c’est l’adresse que vous louez. Tout part de là : un bail s’y rattache, puis les loyers. Le plan Gratuit en accepte deux.',
    cible: 'nav-logements',
    lien: { libelle: 'Ajouter un logement', href: '/app/logements/nouveau' },
    accomplie: (p) => p.nb_logements > 0,
  },
  {
    cle: 'locataire',
    routesAction: ['/app/locataires/nouveau'],
    jalon: 'Locataire',
    titre: 'Ajoutez votre locataire',
    message:
      'Son nom, son téléphone, et votre attestation de l’avoir informé de la collecte de ses données. L’email est facultatif — il sert à lui envoyer ses quittances.',
    cible: 'nav-locataires',
    lien: { libelle: 'Ajouter un locataire', href: '/app/locataires/nouveau' },
    accomplie: (p) => p.nb_locataires > 0,
  },
  {
    cle: 'bail',
    routesAction: ['/app/baux/nouveau'],
    jalon: 'Bail',
    titre: 'Reliez les deux par un bail',
    message:
      'Le bail associe le logement au locataire : le loyer, le jour d’échéance, et le nombre de jours que vous tolérez avant qu’un retard soit signalé.',
    cible: 'nav-baux',
    lien: { libelle: 'Créer le bail', href: '/app/baux/nouveau' },
    accomplie: (p) => p.nb_baux > 0,
  },
  {
    cle: 'paiement',
    routesAction: ['/app/paiements/nouveau', '/app/paiements/'],
    jalon: 'Paiement',
    titre: 'Enregistrez un loyer reçu',
    message:
      'Le montant, la date, le mode de règlement. Un récapitulatif vous est présenté avant validation — c’est lui qui déclenche le document.',
    cible: 'bouton-paiement',
    lien: { libelle: 'Enregistrer un paiement', href: '/app/paiements/nouveau' },
    accomplie: (p) => p.nb_paiements > 0,
  },
  {
    cle: 'quittance',
    routesAction: ['/app/quittances/'],
    jalon: 'Quittance',
    titre: 'Votre quittance est prête',
    message:
      'Elle a été produite à la validation du paiement : numérotée, horodatée, signée. Ouvrez-la, téléchargez-la, ou envoyez-la à votre locataire sur WhatsApp.',
    cible: 'nav-paiements',
    lien: { libelle: 'Voir mes paiements', href: '/app/paiements' },
    accomplie: (p) => p.nb_quittances > 0,
  },
]

/** Écran de fin. Hors du tableau ci-dessus : il n'attend aucune action. */
export const ETAPE_FINALE = {
  cle: 'fin',
  titre: 'Vous avez fait le tour',
  message:
    'Vous venez d’enregistrer un loyer et d’en produire la quittance. C’est l’essentiel de Sikaloc — le reste se découvre en s’en servant.',
} as const

export type EtatVisite = 'non_commencee' | 'en_cours' | 'terminee' | 'quittee'

export interface AvancementVisite {
  etat: EtatVisite
  /** Index de la première étape non accomplie, ou `ETAPES.length` si tout l'est. */
  index: number
  /** Une entrée par étape, dans l'ordre, pour la liste de progression. */
  jalons: { cle: string; libelle: string; accompli: boolean; courant: boolean }[]
  /** Toutes les étapes sont-elles accomplies ? */
  complet: boolean
}

/**
 * Où en est le bailleur.
 *
 * `etat` vient de deux dates en base, l'avancement des compteurs. Les deux sont
 * indépendants : quelqu'un peut avoir tout accompli sans jamais avoir suivi la
 * visite, et inversement l'avoir quittée après trois étapes.
 */
export function avancement(
  progression: ProgressionVisite,
  dates: { tutoriel_vu_le: string | null; visite_quittee_le: string | null },
): AvancementVisite {
  const accomplies = ETAPES.map((e) => e.accomplie(progression))

  // Première étape non accomplie. `indexOf(false)` rend -1 quand tout est fait.
  const premiereOuverte = accomplies.indexOf(false)
  const complet = premiereOuverte === -1
  const index = complet ? ETAPES.length : premiereOuverte

  const etat: EtatVisite = dates.tutoriel_vu_le
    ? 'terminee'
    : dates.visite_quittee_le
      ? 'quittee'
      : accomplies.some(Boolean)
        ? 'en_cours'
        : 'non_commencee'

  return {
    etat,
    index,
    complet,
    jalons: ETAPES.map((etape, rang) => ({
      cle: etape.cle,
      libelle: etape.jalon,
      accompli: accomplies[rang],
      courant: rang === index,
    })),
  }
}

/**
 * La visite doit-elle s'ouvrir d'elle-même ?
 *
 * Seulement pour qui ne l'a ni terminée ni quittée. Une visite quittée reste
 * reprenable depuis le tableau de bord, mais ne s'impose plus à chaque arrivée :
 * c'est la différence entre accompagner et harceler.
 */
export function ouvertureAutomatique(a: AvancementVisite): boolean {
  return a.etat !== 'terminee' && a.etat !== 'quittee' && !a.complet
}
