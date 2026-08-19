/**
 * Types de la base Sikaloc.
 *
 * Écrits à la main pour rester lisibles et versionnés avec les migrations.
 * Pour les régénérer depuis la base réelle :
 *   npx supabase gen types typescript --local > src/lib/types/database.ts
 */

export type TypeLogement =
  | 'Appartement'
  | 'Maison'
  | 'Studio'
  | 'Boutique'
  | 'Autre'

export type StatutBail = 'Actif' | 'Résilié'

export type ModePaiement =
  | 'Espèces'
  | 'Mobile Money'
  | 'Virement bancaire'
  | 'Autre'

export type TypePaiement = 'Loyer' | 'Charges' | 'Dépôt de garantie'

export type StatutPaiement = 'Brouillon' | 'Validé'

export type PlanAbonnement = 'Gratuit' | 'Standard'

export type TypeDocument = 'Quittance' | 'Reçu'

/** Étapes du cycle de grâce en cas d'impayé d'abonnement (v2.1 §4). */
export type StatutAbonnement =
  | 'actif'
  | 'grace'
  | 'lecture_seule'
  | 'suspendu'
  | 'supprime'

export const TYPES_LOGEMENT: TypeLogement[] = [
  'Appartement',
  'Maison',
  'Studio',
  'Boutique',
  'Autre',
]

export const MODES_PAIEMENT: ModePaiement[] = [
  'Espèces',
  'Mobile Money',
  'Virement bancaire',
  'Autre',
]

export const TYPES_PAIEMENT: TypePaiement[] = [
  'Loyer',
  'Charges',
  'Dépôt de garantie',
]

export type Bailleur = {
  id: string
  nom: string
  telephone: string
  email: string
  adresse: string | null
  signature_chemin: string | null
  plan: PlanAbonnement
  date_fin_abonnement: string | null
  parrain_id: string | null
  code_parrainage: string
  nb_logements_declare: number | null
  onboarding_termine: boolean
  notif_email: boolean
  notif_whatsapp: boolean
  statut_abonnement: StatutAbonnement
  date_echec_paiement: string | null
  dernier_rappel_envoye: string | null
  /** Avatar Open Peeps « tenue-coiffure-visage-pilosite-accessoire ». NULL = dérivé de l'id. */
  avatar: string | null
  created_at: string
}

export type Locataire = {
  id: string
  bailleur_id: string
  nom: string
  telephone: string
  email: string | null
  consentement_donnees: boolean
  date_consentement: string | null
  /** Avatar Open Peeps « tenue-coiffure-visage-pilosite-accessoire ». NULL = dérivé de l'id. */
  avatar: string | null
  created_at: string
}

export type Logement = {
  id: string
  bailleur_id: string
  adresse: string
  type: TypeLogement
  ville: string
  pays: string
  created_at: string
}

export type Bail = {
  id: string
  bailleur_id: string
  logement_id: string
  locataire_id: string
  loyer_mensuel: number
  date_debut: string
  date_fin: string | null
  jour_echeance: number
  tolerance_jours: number
  depot_garantie: number | null
  statut: StatutBail
  created_at: string
}

export type Paiement = {
  id: string
  bailleur_id: string
  bail_id: string
  date_paiement: string
  montant: number
  periode_debut: string
  periode_fin: string
  mode_paiement: ModePaiement
  type_paiement: TypePaiement
  est_partiel: boolean
  statut: StatutPaiement
  valide_le: string | null
  created_at: string
}

export type Quittance = {
  id: string
  bailleur_id: string
  paiement_id: string
  bail_id: string
  numero_document: string | null
  hash_sha256: string | null
  type: TypeDocument
  pays: string
  date_generation: string
  pdf_chemin: string | null
  created_at: string
}

export type AbonnementTransaction = {
  id: string
  bailleur_id: string
  transaction_id: string
  montant: number
  devise: string
  statut: string
  operateur: string | null
  payload_notif: unknown
  created_at: string
  mis_a_jour_le: string
}

export type RecompenseParrainage = {
  id: string
  parrain_id: string
  filleul_id: string
  mois_offerts: number
  attribuee_le: string
}

export type EmailAEnvoyer = {
  id: string
  bailleur_id: string
  destinataire: string
  modele: string
  variables: Record<string, unknown>
  cree_le: string
  envoye_le: string | null
  tentatives: number
  derniere_erreur: string | null
}

export type JournalPurge = {
  id: string
  bailleur_id: string
  locataires_anonymises: number
  documents_supprimes: number
  fichiers_a_supprimer: string[]
  fichiers_supprimes_le: string | null
  purge_le: string
}

export type CompteurDocuments = {
  bailleur_id: string
  annee: number
  dernier_numero: number
}

/** Journal du rate limiting. Accessible au seul rôle service_role. */
export type TentativeConnexion = {
  id: number
  email: string
  reussie: boolean
  ip: string | null
  tentee_le: string
}

export type Impaye = {
  bail_id: string
  bailleur_id: string
  locataire_id: string
  logement_id: string
  periode_debut: string
  periode_fin: string
  date_echeance: string
  loyer_mensuel: number
  tolerance_jours: number
  montant_paye: number
  montant_du: number
  jours_de_retard: number
  locataire_nom: string
  locataire_telephone: string
  logement_adresse: string
  logement_ville: string
}

export type MetriquesDashboard = {
  bailleur_id: string
  nb_logements: number
  nb_baux_actifs: number
  taux_occupation: number
  loyers_attendus_mois: number
  loyers_percus_mois: number
  ca_du_mois: number
  nb_impayes: number
  montant_impaye_total: number
}

/** Bail enrichi des entités liées — forme renvoyée par les embeds PostgREST. */
export type BailDetaille = Bail & {
  logement: Pick<Logement, 'id' | 'adresse' | 'ville' | 'type' | 'pays'>
  locataire: Pick<Locataire, 'id' | 'nom' | 'telephone' | 'email'>
}

export type PaiementDetaille = Paiement & {
  bail: BailDetaille
  quittance: Pick<Quittance, 'id' | 'numero_document' | 'type'> | null
}

/**
 * Les formes `Ligne` et `Vue` suivent le contrat `GenericTable` / `GenericView`
 * de postgrest-js : sans la clé `Relationships`, l'inférence de types échoue et
 * toutes les requêtes retombent sur `never`.
 *
 * `Relationships: []` désactive simplement la vérification statique des embeds
 * (`select('bail:baux(...)')`) — les jointures restent parfaitement valides à
 * l'exécution, elles ne sont pas typées à la compilation.
 */
type Ligne<T> = {
  Row: T
  Insert: Partial<T>
  Update: Partial<T>
  Relationships: []
}

type Vue<T> = { Row: T; Relationships: [] }

export interface Database {
  public: {
    Tables: {
      bailleurs: Ligne<Bailleur>
      locataires: Ligne<Locataire>
      logements: Ligne<Logement>
      baux: Ligne<Bail>
      paiements: Ligne<Paiement>
      quittances: Ligne<Quittance>
      abonnements_transactions: Ligne<AbonnementTransaction>
      recompenses_parrainage: Ligne<RecompenseParrainage>
      tentatives_connexion: Ligne<TentativeConnexion>
      emails_a_envoyer: Ligne<EmailAEnvoyer>
      journal_purges: Ligne<JournalPurge>
      compteurs_documents: Ligne<CompteurDocuments>
    }
    Views: {
      v_impayes: Vue<Impaye>
      v_metriques_dashboard: Vue<MetriquesDashboard>
    }
    Functions: {
      creer_premier_bail: {
        Args: {
          p_locataire_nom: string
          p_locataire_telephone: string
          p_logement_adresse: string
          p_logement_ville: string
          p_logement_type: TypeLogement
          p_loyer_mensuel: number
          p_jour_echeance: number
          p_date_debut: string
        }
        Returns: string
      }
      /** Cycle de grâce — réservé au service_role (voir migration 20260818000100). */
      executer_cycle_grace: {
        Args: Record<string, never>
        Returns: { bailleur: string; ancien: string; nouveau: string }[]
      }
      /** Purge J+90, volet base — réservé au service_role. */
      executer_purge_j90: {
        Args: Record<string, never>
        Returns: { bailleur: string; locataires: number; fichiers: number }[]
      }
    }
    Enums: {
      type_logement: TypeLogement
      statut_bail: StatutBail
      mode_paiement: ModePaiement
      type_paiement: TypePaiement
      statut_paiement: StatutPaiement
      plan_abonnement: PlanAbonnement
      type_document: TypeDocument
      statut_abonnement: StatutAbonnement
    }
  }
}
