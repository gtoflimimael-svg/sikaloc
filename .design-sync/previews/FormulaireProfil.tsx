import { FormulaireProfil } from 'sikaloc-mvp'

const bailleur = {
  id: 'b-1',
  nom: 'Comlan Houngbédji',
  telephone: '+229 97 12 34 56',
  email: 'comlan@exemple.bj',
  adresse: 'Cotonou, Aïdjèdo — Lot 42',
  signature_chemin: null,
  plan: 'mensuel',
  date_fin_abonnement: '2026-12-31',
  parrain_id: null,
  code_parrainage: 'SIKA-4821',
  nb_logements_declare: 9,
  onboarding_termine: true,
  notif_email: true,
  notif_whatsapp: true,
  statut_abonnement: 'actif',
  date_echec_paiement: null,
  dernier_rappel_envoye: null,
  created_at: '2025-01-12T09:00:00Z',
} as never

export function Standard() {
  return <FormulaireProfil bailleur={bailleur} />
}
