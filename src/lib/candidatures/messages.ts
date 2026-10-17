import type { StatutCandidature } from '@/lib/types/database'

/**
 * Ce que les fonctions de candidature répondent, dit au candidat.
 *
 * Les fonctions de S8-A rendent un MOTIF — jamais un code SQL. Ce module le
 * traduit ; le motif inconnu tombe sur une phrase générique plutôt que de
 * s'afficher tel quel.
 */
export const MESSAGES_CANDIDATURE: Record<string, string> = {
  authentification_requise: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  profil_absent: 'Complétez votre profil avant d’envoyer votre candidature.',
  annonce_indisponible: 'Cette annonce n’est plus disponible.',
  deja_candidate: 'Vous avez déjà candidaté à cette annonce.',
  message_trop_long: 'Votre message dépasse 1 000 caractères.',
  nom_invalide: 'Indiquez votre nom : 2 caractères au moins.',
  telephone_invalide: 'Indiquez un numéro de téléphone valide.',
  introuvable: 'Cette candidature est introuvable.',
  retrait_impossible: 'Cette candidature ne peut plus être retirée.',
  echec: 'L’envoi a échoué. Réessayez dans un instant.',

  // ─── Côté bailleur (S8-C) ──────────────────────────────────────────────
  //
  // `transition_refusee` est le cas courant, pas une anomalie : entre
  // l'affichage de la page et le clic, le candidat a pu retirer sa
  // candidature, ou une autre fenêtre l'avoir déjà acceptée. La phrase dit
  // quoi faire — recharger — plutôt que de décrire la règle enfreinte.
  transition_refusee:
    'Cette candidature a changé d’état entre-temps. Rechargez la page pour voir où elle en est.',
  reponse_invalide: 'Cette réponse n’est pas possible.',
  echec_reponse: 'La réponse n’a pas pu être enregistrée. Réessayez dans un instant.',
}

export const messageCandidature = (motif?: string | null): string =>
  MESSAGES_CANDIDATURE[motif ?? ''] ?? MESSAGES_CANDIDATURE.echec

export const LIBELLES_STATUT_CANDIDATURE: Record<StatutCandidature, string> = {
  envoyee: 'Envoyée',
  en_etude: 'En étude',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  retiree: 'Retirée',
}

export const TON_STATUT_CANDIDATURE: Record<
  StatutCandidature,
  'positive' | 'warning' | 'negative' | 'neutral'
> = {
  envoyee: 'neutral',
  en_etude: 'warning',
  acceptee: 'positive',
  refusee: 'negative',
  retiree: 'neutral',
}
