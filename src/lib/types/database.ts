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
  /** Le COMPTE (auth.users) vérifié — bailleur ou candidat. */
  compte_id: string
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
  /**
   * Ce locataire accepte-t-il les emails de Sikaloc — quittance, relance ?
   *
   * Vrai par défaut. Respecté par les envois déclenchés par le bailleur comme
   * par les envois automatiques : une personne qui demande qu'on s'arrête n'a
   * pas à le redemander à chaque canal.
   */
  notif_email: boolean
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

/* ═══ Sikaloc_Find — les annonces (migration 20260919000100) ═════════════════
 *
 * Une annonce n'est pas un logement : elle en recopie le type et la ville à sa
 * création, et ne rend jamais l'adresse. Privée en S1 — seul le bailleur
 * propriétaire la lit.
 */

export type StatutAnnonce = 'brouillon' | 'publiee' | 'suspendue' | 'cloturee'

export type MotifClotureAnnonce = 'louee_sikaloc' | 'louee_ailleurs' | 'retiree'

/**
 * La liste fermée des équipements. La même vit dans la contrainte
 * `annonces_equipements_valides` : une valeur ajoutée ici sans migration serait
 * refusée par la base.
 */
export const EQUIPEMENTS_ANNONCE = [
  'eau_courante',
  'electricite',
  'compteur_eau_individuel',
  'compteur_electrique_individuel',
  'douche_interieure',
  'wc_interieur',
  'cuisine_interieure',
  'cour_cloturee',
  'gardien',
  'parking',
  'climatisation',
] as const

export type EquipementAnnonce = (typeof EQUIPEMENTS_ANNONCE)[number]

export type Annonce = {
  id: string
  /** Identifiant public : 10 caractères base32, générés par la base. Ne change jamais. */
  reference: string
  bailleur_id: string
  /** NULL seulement pour une annonce clôturée dont le logement a été supprimé. */
  logement_id: string | null
  statut: StatutAnnonce
  /** Renseigné si et seulement si l'annonce est clôturée. */
  motif_cloture: MotifClotureAnnonce | null
  type: TypeLogement
  ville: string
  quartier: string | null
  /** 0 = entrer-coucher ou studio. */
  chambres: number | null
  surface_m2: number | null
  /** Montants entiers en FCFA. */
  loyer: number | null
  /** NULL = non précisées, 0 = aucune. */
  charges: number | null
  /** La caution. Même nom que dans `baux`. */
  depot_garantie: number | null
  avance_mois: number | null
  equipements: EquipementAnnonce[]
  description: string | null
  /** NULL = disponible dès maintenant. */
  disponible_le: string | null
  /** Premier passage à « publiée ». Jamais réécrite ensuite. */
  publiee_le: string | null
  cloturee_le: string | null
  created_at: string
  mis_a_jour_le: string
}

/**
 * Une annonce vue par le public (migration 20260919000200).
 *
 * Ne décrit aucune table : c'est le retour de `annonces_publiees` et de
 * `annonce_publiee`, qui énumèrent leurs colonnes. Ni `id`, ni `bailleur_id`,
 * ni `logement_id`, ni statut : ce qui manque ici par rapport à `Annonce` est
 * la réponse à « le public n'a pas à le connaître ».
 */
export type AnnoncePublique = Pick<
  Annonce,
  | 'reference'
  | 'type'
  | 'ville'
  | 'quartier'
  | 'chambres'
  | 'surface_m2'
  | 'loyer'
  | 'charges'
  | 'depot_garantie'
  | 'avance_mois'
  | 'equipements'
  | 'description'
  | 'disponible_le'
  | 'publiee_le'
> & {
  /**
   * La photo principale (migration 20260919000400) : sa position — la plus
   * petite présente, 0 en temps normal — et ses dimensions. Jamais son chemin.
   * Servie par `/find/photo/[reference]/[position]`.
   */
  photo_position: number | null
  photo_largeur: number | null
  photo_hauteur: number | null
}

/**
 * Une photo d'annonce publiée, telle que la galerie la connaît
 * (migration 20260919000500) : sa position et ses dimensions. Le fichier se
 * lit par `/find/photo/[reference]/[position]` ; le chemin ne sort jamais.
 */
export type PhotoPublique = { position: number; largeur: number; hauteur: number }

/**
 * Le bailleur d'une annonce publiée, tel que le public le voit.
 *
 * `telephone_verifie` ne compte que les codes reçus par SMS ou WhatsApp : une
 * attestation ADMIN n'en fait pas partie.
 */
export type ProfilPublicBailleur = {
  /** « Koffi A. » — jamais le nom complet. */
  nom_affiche: string | null
  telephone_verifie: boolean
}

/** Une photo d'annonce. La position 0 est la photo principale ; 8 au plus. */
export type AnnoncePhoto = {
  id: string
  annonce_id: string
  bailleur_id: string
  /** `<bailleur_id>/<annonce_id>/<uuid>.jpg|webp`, jamais une URL. */
  chemin: string
  position: number
  largeur: number
  hauteur: number
  type_mime: 'image/jpeg' | 'image/webp'
  poids: number
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

/** Tarif contractuel d'un bail, effectif à partir du mois indiqué. */
export type BailLoyer = {
  bail_id: string
  periode_debut: string
  loyer_mensuel: number
  cree_le: string
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
  donnees_financieres: unknown | null
  id: string
  bailleur_id: string
  paiement_id: string
  numero_document: string | null
  hash_sha256: string | null
  type: TypeDocument
  pays: string
  date_generation: string
  pdf_chemin: string | null
  created_at: string
}

export type AbonnementTransaction = {
  reference_fedapay: string | null
  environnement_fedapay: 'sandbox' | 'live' | null
  formule: 'Standard'
  contrat_fedapay: 'historique' | 'standard_v1'
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
  etat_traitement: 'attente' | 'reserve' | 'accepte' | 'temporaire' | 'definitif' | 'indisponible' | 'incertain' | 'a_verifier'
  reservation: string | null
  reserve_jusqua: string | null
  prochain_essai: string
  premiere_tentative: string | null
  transport_id: string | null
}

/**
 * Une notification de candidature en attente d'envoi (S8-D).
 *
 * Même forme de service que `EmailAEnvoyer` — destinataire, modèle, variables,
 * tentatives — pour que le même travailleur vide les deux files de la même
 * manière. Ce qui diffère est ce qu'elle désigne : une candidature, et qui
 * doit en être prévenu.
 */
export type NotificationCandidature = {
  id: string
  candidature_id: string
  /** 'nouvelle' | 'en_etude' | 'acceptee' | 'refusee' | 'retiree' */
  evenement: string
  /** 'bailleur' | 'candidat' */
  destinataire_role: string
  /** L'adresse, figée au moment de l'événement. */
  destinataire: string
  modele: string
  variables: Record<string, unknown>
  cree_le: string
  envoye_le: string | null
  tentatives: number
  derniere_erreur: string | null
  etat_traitement: 'attente' | 'reserve' | 'accepte' | 'temporaire' | 'definitif' | 'indisponible' | 'incertain' | 'a_verifier'
  reservation: string | null
  reserve_jusqua: string | null
  prochain_essai: string
  premiere_tentative: string | null
  transport_id: string | null
}

/**
 * Une notification WhatsApp en attente d'envoi (S8-F).
 *
 * La jumelle de `NotificationCandidature`, pour le second canal : mêmes
 * colonnes de service, mais `destinataire` porte un NUMÉRO (`+229…`) et non une
 * adresse. Sa file est distincte pour qu'un échec WhatsApp n'atteigne jamais
 * l'email.
 */
export type NotificationWhatsApp = {
  id: string
  candidature_id: string
  evenement: string
  destinataire_role: string
  /** Le numéro canonique, figé au moment de l'événement. */
  destinataire: string
  modele: string
  variables: Record<string, unknown>
  cree_le: string
  envoye_le: string | null
  tentatives: number
  derniere_erreur: string | null
  etat_traitement: 'attente' | 'reserve' | 'accepte' | 'temporaire' | 'definitif' | 'indisponible' | 'incertain' | 'a_verifier'
  reservation: string | null
  reserve_jusqua: string | null
  prochain_essai: string
  premiere_tentative: string | null
  transport_id: string | null
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
  /** Part payée au-delà du loyer de ce mois, non affectée au mois suivant. */
  montant_excedentaire: number
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

/**
 * Une invitation à rejoindre Sikaloc_Me.
 *
 * Le jeton n'y figure pas — seulement son empreinte. Un jeton d'invitation
 * ouvre l'accès aux documents de loyer d'une personne : en clair dans la
 * table, il serait utilisable tel quel par quiconque lirait une sauvegarde.
 */
export type InvitationLocataire = {
  id: string
  locataire_id: string
  bailleur_id: string
  /** L'adresse au moment de l'envoi, figée : corriger la fiche ensuite ne la réécrit pas. */
  email: string
  /** HMAC-SHA256(jeton, OTP_SECRET). */
  empreinte: string
  expire_le: string
  /** Consommée par un rattachement. Usage unique. */
  utilisee_le: string | null
  /** Révoquée par le bailleur, ou périmée par un nouvel envoi. */
  annulee_le: string | null
  cree_le: string
  cree_par: string | null
}

/* ═══ Sikaloc_Find — candidats et candidatures (migration 20260919000700) ═══
 *
 * `candidats` est le profil du compte qui candidate : sa clé primaire EST
 * l'identifiant du compte, comme pour `bailleurs`. Le nom et le téléphone y
 * vivent parce qu'ils n'existent nulle part ailleurs pour ce compte ; l'email
 * reste dans `auth.users`.
 *
 * Rien de tout cela n'est public : aucune fonction de Find ne l'expose.
 */

export type StatutCandidature = 'envoyee' | 'en_etude' | 'acceptee' | 'refusee' | 'retiree'

export type Candidat = {
  /** L'identifiant du compte lui-même. */
  id: string
  nom: string
  /** Forme canonique, posée par `prive.canoniser_telephone`. */
  telephone: string
  /** Consentement WhatsApp — opt-in explicite, défaut faux (S8-F). */
  notif_whatsapp: boolean
  /** Vérification du numéro par code OTP. NULL = pas vérifié (S8-G). */
  telephone_verifie_le: string | null
  created_at: string
  mis_a_jour_le: string
}

export type Candidature = {
  id: string
  /** NULL quand le compte a été supprimé : la candidature reste, l'identité part. */
  candidat_id: string | null
  /** L'identifiant interne de l'annonce, jamais sa référence publique. */
  annonce_id: string
  statut: StatutCandidature
  message: string | null
  /** Renseignée si et seulement si la candidature est acceptée ou refusée. */
  repondue_le: string | null
  created_at: string
  mis_a_jour_le: string
}

/** Une candidature vue par son candidat, avec de quoi reconnaître l'annonce. */
export type CandidatureDuCandidat = {
  candidature_id: string
  statut: StatutCandidature
  message: string | null
  deposee_le: string
  repondue_le: string | null
  reference: string
  annonce_type: TypeLogement
  annonce_ville: string
  annonce_quartier: string | null
  annonce_loyer: number | null
  annonce_statut: StatutAnnonce
}

/**
 * Une candidature vue par le bailleur de l'annonce : le nom du candidat, et
 * rien d'autre de lui. Ni téléphone, ni email — leur transmission demande un
 * consentement qui n'existe pas encore.
 */
export type CandidatureDuBailleur = {
  candidature_id: string
  reference: string
  statut: StatutCandidature
  message: string | null
  deposee_le: string
  repondue_le: string | null
  /** NULL si le compte du candidat a été supprimé. */
  candidat_nom: string | null
}

/**
 * Le décompte d'une annonce, pour la liste de Sikaloc_Pro.
 *
 * Des entiers, et rien d'autre : de quoi écrire « 3 candidatures · 2
 * nouvelles » sans rapatrier un seul message.
 */
export type CompteurCandidatures = {
  annonce_id: string
  total: number
  /** Celles encore au statut « envoyée » : personne n'y a répondu. */
  nouvelles: number
}

/* ═══ Sikaloc_Me — ce qu'un locataire lit ═══════════════════════════════════
 *
 * Ces quatre types ne décrivent aucune table : ce sont les retours des
 * fonctions de la migration 20260913000700, qui énumèrent colonne par colonne
 * ce qu'un locataire a le droit de voir.
 *
 * Ils sont volontairement PLUS ÉTROITS que `Bail`, `Paiement` et `Quittance`.
 * Si une colonne manque ici par rapport à la table, ce n'est pas un oubli :
 * c'est la réponse à « le locataire n'a pas à la connaître ».
 */

/** Un bail vu depuis Sikaloc_Me, avec son logement et de quoi joindre le bailleur. */
export type BailLocataire = {
  bail_id: string
  statut: StatutBail
  loyer_mensuel: number
  depot_garantie: number | null
  date_debut: string
  date_fin: string | null
  jour_echeance: number
  tolerance_jours: number
  locataire_nom: string
  logement_adresse: string
  logement_ville: string
  logement_pays: string
  logement_type: TypeLogement
  bailleur_nom: string
  /**
   * Le téléphone, et pas l'email : `bailleurs.email` est l'adresse de
   * connexion du compte Sikaloc du bailleur. Elle ne figure sur aucune
   * quittance et n'a rien à faire dans l'espace de son locataire.
   */
  bailleur_telephone: string
}

/**
 * Une échéance vue depuis Sikaloc_Me.
 *
 * Même `etat` que côté bailleur — c'est `v_echeances` qui le calcule, et elle
 * seule. Sans `anterieure` ni `historique_declare` : ces deux-là racontent
 * depuis quand le bailleur utilise Sikaloc, ce qui ne regarde pas son
 * locataire.
 */
export type EcheanceLocataire = {
  bail_id: string
  periode_debut: string
  periode_fin: string
  date_echeance: string
  loyer_mensuel: number
  montant_paye: number
  montant_du: number
  montant_excedentaire: number
  jours_de_retard: number
  etat: EtatEcheance
}

/** Un versement validé, et la quittance émise pour lui s'il y en a une. */
export type PaiementLocataire = {
  paiement_id: string
  bail_id: string
  /** NULL pour un loyer déclaré réglé avant Sikaloc : la date réelle est inconnue. */
  date_paiement: string | null
  montant: number
  periode_debut: string
  periode_fin: string
  mode_paiement: ModePaiement
  type_paiement: TypePaiement
  est_partiel: boolean
  historique: boolean
  quittance_id: string | null
  quittance_numero: string | null
  quittance_type: TypeDocument | null
  /**
   * Le fichier est-il encore dans le coffre ?
   *
   * La purge J+90 met `pdf_chemin` à NULL et fait effacer l'objet, mais laisse
   * la ligne et son numéro. Sans ce drapeau, l'écran proposerait de télécharger
   * un document détruit.
   */
  quittance_telechargeable: boolean
}

/**
 * La preuve qu'une quittance appartient à l'appelant.
 *
 * Sans le chemin du fichier, délibérément : cette fonction est appelable
 * depuis un navigateur, et `quittances.pdf_chemin` commence par l'identifiant
 * de compte du bailleur. La route qui sert le PDF relit le chemin elle-même,
 * en administration, une fois l'appartenance établie.
 */
export type QuittanceLocataire = {
  quittance_id: string
  paiement_id: string
  numero_document: string | null
  type: TypeDocument
  date_generation: string
  hash_sha256: string | null
  /** Une signature a été apposée : le document ne se refabrique pas. */
  signee: boolean
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
      baux_loyers: Ligne<BailLoyer>
      paiements: Ligne<Paiement>
      quittances: Ligne<Quittance>
      abonnements_transactions: Ligne<AbonnementTransaction>
      recompenses_parrainage: Ligne<RecompenseParrainage>
      signatures_apposees: Ligne<SignatureApposee>
      tentatives_connexion: Ligne<TentativeConnexion>
      emails_a_envoyer: Ligne<EmailAEnvoyer>
      notifications_candidature: Ligne<NotificationCandidature>
      notifications_whatsapp: Ligne<NotificationWhatsApp>
      journal_purges: Ligne<JournalPurge>
      compteurs_documents: Ligne<CompteurDocuments>
      inscriptions_guide: Ligne<InscriptionGuide>
      codes_verification: Ligne<CodeVerification>
      invitations_locataire: Ligne<InvitationLocataire>
      annonces: Ligne<Annonce>
      annonce_photos: Ligne<AnnoncePhoto>
      candidats: Ligne<Candidat>
      candidatures: Ligne<Candidature>
    }
    Views: {
      v_impayes: Vue<Impaye>
      v_metriques_dashboard: Vue<MetriquesDashboard>
      v_progression_visite: Vue<ProgressionVisite>
      v_echeances: Vue<Echeance>
    }
    Functions: {
      /** Change le statut du bail propre à l'appelant avec les effets de la transition en base. */
      definir_statut_bail: {
        Args: { p_bail_id: string; p_statut: StatutBail }
        Returns: StatutBail
      }
      /** Définit ou efface le chemin de signature du bailleur appelant, après contrôle de statut et de format. */
      definir_signature_bailleur: {
        Args: { p_chemin: string | null }
        Returns: undefined
      }
      /** Définit ou efface le chemin de signature d'un locataire propriétaire, après contrôle d'abonnement. */
      definir_signature_locataire: {
        Args: { p_locataire_id: string; p_chemin: string | null }
        Returns: undefined
      }
      /** Crée un brouillon en calculant le cumul et le propriétaire en base. */
      creer_paiement_brouillon: {
        Args: {
          p_bail_id: string
          p_date_paiement: string
          p_montant: number
          p_periode_debut: string
          p_mode_paiement: ModePaiement
          p_type_paiement?: TypePaiement
        }
        Returns: string
      }
      /** Corrige un paiement du bailleur appelant dans les conditions métier. */
      corriger_paiement: {
        Args: {
          p_paiement_id: string
          p_bail_id: string
          p_date_paiement: string
          p_montant: number
          p_periode_debut: string
          p_mode_paiement: ModePaiement
          p_type_paiement: TypePaiement
        }
        Returns: string
      }
      supprimer_paiement: {
        Args: { p_paiement_id: string }
        Returns: boolean
      }
      /** Crée les lignes historiques et pose leur marqueur dans une seule transaction. */
      declarer_paiements_historiques: {
        Args: { p_bail_id: string; p_periodes: string[] }
        Returns: number
      }
      reserver_notification: {
        Args: { p_file: string; p_operationnel: boolean }
        Returns: Record<string, unknown>[]
      }
      terminer_notification: {
        Args: { p_file: string; p_id: string; p_reservation: string; p_etat: string; p_transport_id?: string }
        Returns: boolean
      }
      liberer_emission_quittance: {
        Args: { p_acteur: string; p_paiement: string; p_jeton: string }
        Returns: undefined
      }
      finaliser_abonnement_fedapay: {
        Args: { p_transaction_id: string; p_reference: string; p_bailleur: string;
          p_montant: number; p_devise: string; p_statut: string; p_formule: string; p_environnement: string }
        Returns: string
      }
      preparer_emission_quittance: {
        Args: { p_acteur: string; p_paiement: string; p_valider?: boolean }
        Returns: unknown
      }
      publier_emission_quittance: {
        Args: { p_acteur: string; p_paiement: string; p_jeton: string; p_hash: string; p_snapshot?: string | null; p_hash_signature?: string | null }
        Returns: undefined
      }
      lire_quittance_autorisee: {
        Args: { p_acteur: string; p_quittance: string }
        Returns: unknown
      }
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
       * Les rôles de l'appelant — bailleur, locataire, candidat, ou plusieurs.
       *
       * `SECURITY DEFINER` par nécessité : un locataire ne verrait jamais sa
       * propre ligne `locataires`, dont les politiques ne rendent que celles
       * du bailleur propriétaire. Ne rend que deux booléens le concernant.
       */
      mes_roles: {
        Args: Record<string, never>
        Returns: { est_bailleur: boolean; est_locataire: boolean; est_candidat: boolean }[]
      }
      /**
       * Consomme une invitation et rattache le compte appelant à sa ligne
       * locataire. Atomique : les trois écritures réussissent ou échouent
       * ensemble.
       */
      accepter_invitation: {
        Args: { p_empreinte: string }
        Returns: { locataire_id: string | null; bailleur_id: string | null; motif: string }[]
      }
      /* ─── Sikaloc_Me ──────────────────────────────────────────────────
       *
       * La surface d'accès du locataire (migration 20260913000700). Cinq
       * fonctions `SECURITY DEFINER` en lecture seule, parce que les
       * dix-neuf politiques des tables métier disent toutes
       * `auth.uid() = bailleur_id` — un locataire n'y lit rien, pas même sa
       * propre fiche.
       *
       * Aucune ne prend d'identifiant de locataire en argument : chacune
       * déduit l'appelant de sa session. Un paramètre se falsifie, une
       * session non.
       */

      /** Les baux du locataire appelant, actifs et résiliés. */
      mes_baux: {
        Args: Record<string, never>
        Returns: BailLocataire[]
      }
      /** Ses échéances, dans l'état calculé par `v_echeances`. Aucun recalcul. */
      mes_echeances: {
        Args: Record<string, never>
        Returns: EcheanceLocataire[]
      }
      /** Ses versements validés — les brouillons du bailleur sont exclus. */
      mes_paiements: {
        Args: Record<string, never>
        Returns: PaiementLocataire[]
      }
      /** Une de ses quittances, avec le chemin du fichier — usage serveur. */
      ma_quittance: {
        Args: { p_quittance_id: string }
        Returns: QuittanceLocataire[]
      }
      /** Les préférences de notification du locataire appelant. */
      mes_preferences: {
        Args: Record<string, never>
        Returns: { notif_email: boolean }[]
      }
      /**
       * Le seul chemin d'écriture de Sikaloc_Me : un booléen, sur ses propres
       * fiches. Aucune donnée métier n'est atteignable par là.
       */
      definir_mes_notifications: {
        Args: { p_actif: boolean }
        Returns: undefined
      }
      /* ─── Sikaloc_Find — la vitrine ──────────────────────────────────
       *
       * Les portes du public sur les annonces (migration
       * 20260919000200). `SECURITY DEFINER`, ouvertes à `anon` comme à
       * `authenticated`, et indépendantes de l'appelant : une annonce
       * publiée est la même pour tous.
       */

      /** Les annonces publiées, les plus récentes d'abord. 48 au plus par appel. */
      annonces_publiees: {
        Args: { p_limite?: number; p_decalage?: number }
        Returns: AnnoncePublique[]
      }
      /** Une annonce par sa référence. Vide si elle n'est pas publiée. */
      annonce_publiee: {
        Args: { p_reference: string }
        Returns: AnnoncePublique[]
      }
      /**
       * Le chemin interne d'une photo d'annonce publiée. Réservée à la clé de
       * service : seule la route `/find/photo/…` l'appelle.
       */
      photo_publiee: {
        Args: { p_reference: string; p_position: number }
        Returns: { chemin: string; type_mime: string }[]
      }
      /**
       * La recherche (migration 20260919000600) : mêmes colonnes publiques que
       * `annonces_publiees`, filtrées. Un argument `null` ne filtre rien.
       */
      annonces_recherche: {
        Args: {
          p_ville?: string | null
          p_quartier?: string | null
          p_type?: TypeLogement | null
          p_loyer_min?: number | null
          p_loyer_max?: number | null
          p_chambres?: number | null
          p_surface_min?: number | null
          p_surface_max?: number | null
          p_disponible?: boolean | null
          p_equipements?: string[] | null
          p_limite?: number
          p_decalage?: number
        }
        Returns: AnnoncePublique[]
      }
      /** Villes et quartiers des annonces publiées, dédoublonnés. */
      lieux_publies: {
        Args: Record<string, never>
        Returns: { ville: string; quartier: string | null }[]
      }
      /* ─── Candidatures (S8-A) ────────────────────────────────────────
       *
       * Réservées aux comptes connectés : aucune n'est ouverte à `anon`, et
       * chacune rend un MOTIF plutôt qu'une erreur SQL.
       */

      /** Crée ou met à jour le profil candidat du compte appelant. */
      enregistrer_profil_candidat: {
        Args: { p_nom: string; p_telephone: string }
        Returns: { motif: string }[]
      }
      /** Dépose une candidature sur une annonce publiée, désignée par sa référence. */
      soumettre_candidature: {
        Args: { p_reference: string; p_message?: string | null }
        Returns: { candidature_id: string | null; motif: string }[]
      }
      /** Les candidatures du compte appelant. */
      mes_candidatures: {
        Args: Record<string, never>
        Returns: CandidatureDuCandidat[]
      }
      /** Les candidatures reçues sur les annonces du bailleur appelant. */
      candidatures_de_mes_annonces: {
        Args: { p_reference?: string | null; p_limite?: number | null; p_decalage?: number }
        Returns: CandidatureDuBailleur[]
      }
      /** Combien de candidatures par annonce, et combien restent sans réponse. */
      candidatures_par_annonce: {
        Args: Record<string, never>
        Returns: CompteurCandidatures[]
      }
      /** Le candidat retire sa candidature — elle reste, marquée « retirée ». */
      retirer_candidature: {
        Args: { p_candidature_id: string }
        Returns: { motif: string }[]
      }
      /** Le bailleur met en étude, accepte ou refuse une candidature de son annonce. */
      repondre_candidature: {
        Args: { p_candidature_id: string; p_statut: StatutCandidature }
        Returns: { motif: string }[]
      }
      /** Les photos d'une annonce publiée, par position croissante. Sans chemin. */
      photos_publiees: {
        Args: { p_reference: string }
        Returns: PhotoPublique[]
      }
      /** Référence et date de publication de chaque annonce publiée — le plan du site. */
      annonces_publiees_sitemap: {
        Args: Record<string, never>
        Returns: { reference: string; publiee_le: string }[]
      }
      /** Le bailleur d'une annonce publiée : nom réduit, téléphone vérifié par code. */
      profil_public_bailleur: {
        Args: { p_reference: string }
        Returns: ProfilPublicBailleur[]
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
      statut_annonce: StatutAnnonce
      motif_cloture_annonce: MotifClotureAnnonce
      statut_candidature: StatutCandidature
    }
  }
}
