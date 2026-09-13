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
  /** Fin de la visite guidée, menée à son terme. NULL = jamais terminée. */
  tutoriel_vu_le: string | null
  /** Sortie de la visite avant la fin. Renseignée = ne plus l'ouvrir d'elle-même. */
  visite_quittee_le: string | null
  /** Chemin de la photo dans le bucket privé `photos`. Renseignée = prime sur l'avatar. */
  photo_chemin: string | null
  /** Début de la période où l'avatar tient lieu de photo. NULL = pas de période. */
  avatar_temporaire_depuis: string | null
  /**
   * Validation d'un code OTP envoyé au numéro. NULL = jamais vérifié.
   *
   * L'email n'a pas son équivalent ici : GoTrue tient cet état dans
   * `auth.users.email_confirmed_at` et l'expose dans la session.
   */
  telephone_verifie_le: string | null
  /** Canal du code validé : 'SMS' ou 'WHATSAPP'. NULL tant que non vérifié. */
  telephone_canal_verification: CanalTelephoneStocke | null
  created_at: string
}

/**
 * Canal de réception d'un code de vérification téléphonique, tel qu'il est
 * enregistré.
 *
 * `ADMIN` n'est PAS un canal proposable : c'est une attestation manuelle posée
 * en base, sans qu'aucun code n'ait circulé. Ce que l'utilisateur peut choisir
 * est décrit par `CanalTelephone` (src/lib/verification/regles.ts), qui ne
 * connaît que SMS et WHATSAPP.
 */
export type CanalTelephoneStocke = 'SMS' | 'WHATSAPP' | 'ADMIN'

/** Contexte d'un code : les deux vérifications ne partagent jamais un code. */
export type TypeCodeVerification = 'EMAIL_VERIFICATION' | 'PHONE_VERIFICATION'

/** Canal d'acheminement d'un code, email compris. */
export type CanalCodeVerification = 'EMAIL' | 'SMS' | 'WHATSAPP'

/**
 * Un code OTP en attente, ou consommé.
 *
 * Jamais lisible depuis un navigateur : la table a RLS actif et aucune
 * politique, aucun grant à `authenticated`. Seul le code serveur muni de
 * `service_role` y accède.
 */
export type CodeVerification = {
  id: string
  bailleur_id: string
  type: TypeCodeVerification
  canal: CanalCodeVerification
  /** Adresse ou numéro visé, tel qu'il l'a été au moment de la demande. */
  destination: string
  /** HMAC-SHA256(code, OTP_SECRET). Jamais le code lui-même. */
  empreinte: string
  expire_le: string
  tentatives: number
  /** Consommé par une validation réussie. NULL = encore utilisable. */
  utilise_le: string | null
  /** Périmé par un renvoi. NULL = pas remplacé. */
  invalide_le: string | null
  ip: string | null
  cree_le: string
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
  /** Chemin dans le bucket `signatures`. NULL = aucune signature recueillie. */
  signature_chemin: string | null
  /**
   * Compte Sikaloc_Me associé. NULL = ce locataire n'a pas de compte, ce qui
   * reste le cas courant.
   *
   * Non unique à dessein : une même personne peut louer chez deux bailleurs,
   * donc apparaître dans deux lignes pointant vers le même compte.
   */
  compte_id: string | null
  /** Moment de l'association. Rattacher une personne à un bail engage. */
  compte_lie_le: string | null
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
  /**
   * Moment où le bailleur s'est prononcé sur les échéances antérieures à
   * l'enregistrement. NULL = pas encore : ces échéances sont « À déterminer »,
   * jamais « Impayé ».
   */
  historique_declare_le: string | null
  /** Qui a déclaré l'historique — une déclaration de règlement est une affirmation financière. */
  historique_declare_par: string | null
  /**
   * Enregistrement dans Sikaloc, à ne jamais confondre avec `date_debut`. Un
   * bail peut avoir commencé des mois plus tôt ; cette date ne prouve rien sur
   * ce qui a été payé avant elle.
   */
  created_at: string
}

export type Paiement = {
  id: string
  bailleur_id: string
  bail_id: string
  /**
   * Jour de l'encaissement. NULL uniquement pour un paiement historique dont
   * la date réelle n'est pas connue — jamais une date inventée.
   */
  date_paiement: string | null
  montant: number
  periode_debut: string
  periode_fin: string
  mode_paiement: ModePaiement
  type_paiement: TypePaiement
  est_partiel: boolean
  statut: StatutPaiement
  valide_le: string | null
  /**
   * Loyer déclaré comme réglé AVANT l'usage de Sikaloc. Le montant est réel,
   * mais Sikaloc n'a pas assisté à l'encaissement : aucune quittance n'est
   * émise pour ces paiements.
   */
  historique: boolean
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

/**
 * Prospect inscrit au guide. Aucun lien avec `Bailleur` : ces personnes n'ont
 * pas de compte, et la table n'est accessible qu'à la clé de service.
 */
export type InscriptionGuide = {
  id: string
  email: string
  statut: 'en_attente' | 'confirme' | 'desinscrit'
  jeton: string
  origine: string
  cree_le: string
  confirme_le: string | null
  desinscrit_le: string | null
  dernier_envoi_le: string | null
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

/**
 * L'état d'une échéance de loyer.
 *
 * `À déterminer` est la nuance qui manquait : une échéance antérieure à
 * l'enregistrement du bail, sur laquelle le bailleur ne s'est pas encore
 * prononcé. Elle n'est pas réglée, et elle n'est pas impayée non plus — on
 * n'en sait rien, et affirmer le contraire relancerait un locataire à tort.
 */
export type EtatEcheance = 'Réglé' | 'Impayé' | 'À venir' | 'À déterminer'

/**
 * Une ligne par (bail actif, mois). Source unique du calcul : `v_impayes` en
 * est une simple sélection.
 */
export type Echeance = {
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
  /** L'échéance était déjà échue quand le bail a été enregistré dans Sikaloc. */
  anterieure: boolean
  historique_declare: boolean
  etat: EtatEcheance
  locataire_nom: string
  locataire_telephone: string
  logement_adresse: string
  logement_ville: string
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

/**
 * Une signature apposée sur un document, figée.
 *
 * Elle n'est jamais modifiée : les déclencheurs `signatures_apposees_immuable_*`
 * refusent UPDATE et DELETE tant que le document existe et que son paiement est
 * figé. Voir la migration 20260912000500.
 */
export type SignatureApposee = {
  id: string
  quittance_id: string
  bailleur_id: string
  nom_signataire: string
  chemin_snapshot: string | null
  hash_document: string | null
  hash_signature: string | null
  appose_le: string
  retroactif: boolean
}

/**
 * Avancement du bailleur dans la visite guidée.
 *
 * Dérivé de ses données réelles par `v_progression_visite`, donc jamais à
 * synchroniser : il n'existe aucun second état à tenir cohérent.
 */
export type ProgressionVisite = {
  bailleur_id: string
  nb_logements: number
  nb_locataires: number
  nb_baux: number
  nb_paiements: number
  nb_quittances: number
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
      signatures_apposees: Ligne<SignatureApposee>
      tentatives_connexion: Ligne<TentativeConnexion>
      emails_a_envoyer: Ligne<EmailAEnvoyer>
      journal_purges: Ligne<JournalPurge>
      compteurs_documents: Ligne<CompteurDocuments>
      inscriptions_guide: Ligne<InscriptionGuide>
      codes_verification: Ligne<CodeVerification>
    }
    Views: {
      v_impayes: Vue<Impaye>
      v_metriques_dashboard: Vue<MetriquesDashboard>
      v_progression_visite: Vue<ProgressionVisite>
      v_echeances: Vue<Echeance>
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
      /**
       * Les rôles de l'appelant.
       *
       * `SECURITY DEFINER` par nécessité : un locataire ne verrait jamais sa
       * propre ligne `locataires`, dont les politiques ne rendent que celles
       * du bailleur propriétaire. Ne rend que deux booléens le concernant.
       */
      mes_roles: {
        Args: Record<string, never>
        Returns: { est_bailleur: boolean; est_locataire: boolean }[]
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
