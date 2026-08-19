import { BandeauAbonnement } from 'sikaloc-mvp'

// `droits()` ne lit que statut_abonnement et date_echec_paiement ; le reste du
// Bailleur est présent pour rester fidèle au type réel.
const base = {
  id: 'b-1',
  nom: 'Comlan Houngbédji',
  telephone: '+229 97 12 34 56',
  email: 'comlan@exemple.bj',
  adresse: 'Cotonou, Aïdjèdo',
  signature_chemin: null,
  plan: 'mensuel',
  date_fin_abonnement: null,
  parrain_id: null,
  code_parrainage: 'SIKA-4821',
  nb_logements_declare: 9,
  onboarding_termine: true,
  notif_email: true,
  notif_whatsapp: true,
  dernier_rappel_envoye: null,
  created_at: '2025-01-12T09:00:00Z',
} as never

const avec = (statut: string, dateEchec: string | null = '2026-08-02T09:00:00Z') =>
  ({ ...(base as object), statut_abonnement: statut, date_echec_paiement: dateEchec }) as never

export function LectureSeule() {
  return <BandeauAbonnement bailleur={avec('lecture_seule')} />
}

export function Suspendu() {
  return <BandeauAbonnement bailleur={avec('suspendu')} />
}

export function Grace() {
  return <BandeauAbonnement bailleur={avec('grace')} />
}
