/** États remontés par la réconciliation avec l'opérateur. */
export type EtatReglement =
  | 'credite'
  | 'deja_regle'
  | 'en_attente'
  | 'echec'
  | 'inconnu'
  | 'indisponible'
  | 'a_reconcilier'

/** Un retour navigateur n'est jamais une preuve de paiement à lui seul. */
export function retourAbonnementConfirme(etat: EtatReglement | null, planActif: boolean): boolean {
  return etat === 'credite' || (etat === 'deja_regle' && planActif)
}

/** Aucune ligne de transaction : le retour peut être forgé ou périmé. */
export function etatSansTransaction(): EtatReglement {
  return 'inconnu'
}
