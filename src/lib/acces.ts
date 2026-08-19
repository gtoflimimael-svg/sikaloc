import type { Bailleur, StatutAbonnement } from '@/lib/types/database'

/**
 * Droits d'accès dérivés du cycle de grâce — v2.1 §4.4.
 *
 *   actif / grace   accès complet (la grâce n'est qu'un avertissement)
 *   lecture_seule   consultation et téléchargement, écriture bloquée
 *   suspendu        export uniquement
 *   supprime        export uniquement, données personnelles purgées
 *
 * Un point de vigilance : `grace` n'enlève rien. Couper l'accès dès le premier
 * échec de prélèvement pénaliserait un bailleur dont le solde Mobile Money
 * était simplement insuffisant ce jour-là — c'est le sens des trois jours de
 * battement prévus par la spécification.
 */

export interface DroitsAcces {
  statut: StatutAbonnement
  /** Créer ou modifier baux, locataires, logements, paiements. */
  peutEcrire: boolean
  /** Émettre une nouvelle quittance. */
  peutEmettre: boolean
  /** Consulter et télécharger l'existant. */
  peutConsulter: boolean
  /** Bandeau à afficher dans l'application, le cas échéant. */
  avertissement: string | null
}

export function droits(
  bailleur: Pick<Bailleur, 'statut_abonnement' | 'date_echec_paiement'>,
): DroitsAcces {
  const statut = bailleur.statut_abonnement ?? 'actif'

  switch (statut) {
    case 'lecture_seule':
      return {
        statut,
        peutEcrire: false,
        peutEmettre: false,
        peutConsulter: true,
        avertissement:
          'Votre abonnement est impayé : votre compte est en lecture seule. ' +
          'Vous pouvez consulter et télécharger vos documents, mais plus ' +
          'enregistrer de paiement ni émettre de quittance.',
      }

    case 'suspendu':
      return {
        statut,
        peutEcrire: false,
        peutEmettre: false,
        peutConsulter: false,
        avertissement:
          'Votre compte est suspendu depuis 30 jours d’impayé. Vos données ' +
          'restent exportables jusqu’à leur suppression, 90 jours après le ' +
          'premier impayé.',
      }

    case 'supprime':
      return {
        statut,
        peutEcrire: false,
        peutEmettre: false,
        peutConsulter: false,
        avertissement:
          'Les données personnelles de vos locataires ont été supprimées après ' +
          '90 jours d’impayé. Vos pièces comptables restent exportables.',
      }

    case 'grace':
      return {
        statut,
        peutEcrire: true,
        peutEmettre: true,
        peutConsulter: true,
        avertissement:
          'Votre dernier paiement n’a pas abouti. Sans régularisation, votre ' +
          'compte passera en lecture seule sous trois jours.',
      }

    default:
      return {
        statut: 'actif',
        peutEcrire: true,
        peutEmettre: true,
        peutConsulter: true,
        avertissement: null,
      }
  }
}

/** Message renvoyé par une Server Action lorsqu'une écriture est refusée. */
export const MESSAGE_ECRITURE_BLOQUEE =
  'Votre abonnement est impayé : les créations et modifications sont ' +
  'suspendues. Réglez votre abonnement pour rétablir l’accès complet.'
