// Fichier généré par `npm run generer:objets` — ne pas modifier à la main.
//
// Liste des objets que les migrations promettent à la base. Le contrôle de
// schéma compare cette liste à l'inventaire réel de la production.
//
// Figée ici parce que `.vercelignore` exclut `/supabase` : les migrations
// n'accompagnent pas la fonction déployée et sont illisibles à l'exécution.
// `npm run verifier:schema` signale si cette liste a pris du retard.

export interface ObjetDeclare {
  categorie: string
  nom: string
  /** Migration qui le déclare — désigne le fichier à appliquer s'il manque. */
  migration: string
}

export const OBJETS_DECLARES: ObjetDeclare[] = [
  {
    "categorie": "contrainte",
    "nom": "annonce_photos_annonce_fkey",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonce_photos_chemin_key",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonce_photos_chemin_scope",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonce_photos_dimensions_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonce_photos_poids_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonce_photos_position_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonce_photos_position_unique",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonce_photos_type_mime_valide",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_avance_mois_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_chambres_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_charges_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_cloturee_le_coherente",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_complete_hors_brouillon",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_depot_garantie_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_description_longueur",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_equipements_valides",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_id_bailleur_key",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_logement_si_vivante",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_loyer_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_motif_cloture_coherent",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_publiee_le_coherente",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_quartier_longueur",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_reference_format",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_reference_key",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_surface_bornes",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "annonces_ville_longueur",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "bailleurs_avatar_format",
    "migration": "20260819000100_avatars.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "bailleurs_canal_verification_valide",
    "migration": "20260913000200_canal_verification_administratif.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "bailleurs_photo_chemin_scope",
    "migration": "20260912000300_photo_profil.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "bailleurs_signature_chemin_scope",
    "migration": "20260820000200_signature_chemin_contraint.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "baux_historique_declare_par_fkey",
    "migration": "20260920000100_integrite_suppressions.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "candidats_nom_longueur",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "candidats_telephone_longueur",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "candidatures_message_longueur",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "candidatures_reponse_coherente",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "codes_verification_compte_id_fkey",
    "migration": "20260920000300_verification_telephone_candidat.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "invitations_locataire_cree_par_fkey",
    "migration": "20260920000100_integrite_suppressions.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "locataires_avatar_format",
    "migration": "20260819000100_avatars.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "locataires_compte_coherent",
    "migration": "20260913000400_roles_et_compte_locataire.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "locataires_signature_chemin_scope",
    "migration": "20260820000200_signature_chemin_contraint.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "notifications_candidature_destinataire_non_vide",
    "migration": "20260919001000_notifications_candidatures.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "notifications_candidature_evenement_valide",
    "migration": "20260919001000_notifications_candidatures.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "notifications_candidature_role_valide",
    "migration": "20260919001000_notifications_candidatures.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "notifications_candidature_tentatives_bornees",
    "migration": "20260919001000_notifications_candidatures.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "notifications_whatsapp_destinataire_canonique",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "notifications_whatsapp_evenement_valide",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "notifications_whatsapp_role_valide",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "notifications_whatsapp_tentatives_bornees",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "paiements_date_connue_sauf_historique",
    "migration": "20260913000300_echeances_et_historique.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "quittances_numero_unique_par_bailleur",
    "migration": "20260817000700_documents_v2_1.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "signatures_apposees_bailleur_id_fkey",
    "migration": "20260920000100_integrite_suppressions.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "a_verrou_paiements_locatifs",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "annuler_notifications_candidat",
    "migration": "20260919001000_notifications_candidatures.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "attribuer_numero_document",
    "migration": "20260817000700_documents_v2_1.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "canoniser_telephone",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "cloturer_annonce_sur_bail_actif",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "creer_profil_bailleur",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "detacher_compte_locataire",
    "migration": "20260920000100_integrite_suppressions.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "encadrer_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "notifier_candidature",
    "migration": "20260919001000_notifications_candidatures.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "proteger_derniere_photo",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "proteger_paiement_fige_delete",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "proteger_paiement_fige_update",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "proteger_suppression_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "reinitialiser_verification_bailleur",
    "migration": "20260920000400_reinit_verification_telephone_bailleur.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "reinitialiser_verification_candidat",
    "migration": "20260920000300_verification_telephone_candidat.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "signatures_apposees_immuable_delete",
    "migration": "20260912000500_signatures_apposees.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "signatures_apposees_immuable_update",
    "migration": "20260912000500_signatures_apposees.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "toucher_abonnements_transactions",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "toucher_annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "toucher_candidats",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "toucher_candidatures",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "verifier_annonce_candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "verifier_coherence_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "verifier_coherence_bail",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "verifier_coherence_paiement",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "verifier_publication_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "verifier_transition_candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "fonction",
    "nom": "accepter_invitation",
    "migration": "20261015204712_securiser_destinataires_invitations.sql"
  },
  {
    "categorie": "fonction",
    "nom": "annonce_publiee",
    "migration": "20260919000400_find_catalogue.sql"
  },
  {
    "categorie": "fonction",
    "nom": "annonces_publiees",
    "migration": "20260919000400_find_catalogue.sql"
  },
  {
    "categorie": "fonction",
    "nom": "annonces_publiees_sitemap",
    "migration": "20260919000500_find_detail.sql"
  },
  {
    "categorie": "fonction",
    "nom": "annonces_recherche",
    "migration": "20260919000600_find_recherche.sql"
  },
  {
    "categorie": "fonction",
    "nom": "annuler_notifications_candidat",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "fonction",
    "nom": "appliquer_cycle_grace",
    "migration": "20260817000800_cycle_de_grace.sql"
  },
  {
    "categorie": "fonction",
    "nom": "attribuer_numero_document",
    "migration": "20260817000700_documents_v2_1.sql"
  },
  {
    "categorie": "fonction",
    "nom": "candidatures_de_mes_annonces",
    "migration": "20260919000900_candidatures_bailleur.sql"
  },
  {
    "categorie": "fonction",
    "nom": "candidatures_par_annonce",
    "migration": "20260919000900_candidatures_bailleur.sql"
  },
  {
    "categorie": "fonction",
    "nom": "canoniser_telephone",
    "migration": "20260912000600_telephones_canoniques.sql"
  },
  {
    "categorie": "fonction",
    "nom": "cloturer_annonce_sur_bail_actif",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "fonction",
    "nom": "contexte_emission",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "creer_premier_bail",
    "migration": "20260817000600_onboarding_rpc.sql"
  },
  {
    "categorie": "fonction",
    "nom": "definir_mes_notifications",
    "migration": "20260913000900_notifications_locataire.sql"
  },
  {
    "categorie": "fonction",
    "nom": "detacher_compte_locataire",
    "migration": "20260920000100_integrite_suppressions.sql"
  },
  {
    "categorie": "fonction",
    "nom": "empreinte_paiement_locatif",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "encadrer_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "fonction",
    "nom": "enregistrer_profil_candidat",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "fonction",
    "nom": "executer_cycle_grace",
    "migration": "20260818000100_rpc_cycle_grace.sql"
  },
  {
    "categorie": "fonction",
    "nom": "executer_purge_j90",
    "migration": "20260818000100_rpc_cycle_grace.sql"
  },
  {
    "categorie": "fonction",
    "nom": "fiches_du_compte",
    "migration": "20260913000700_acces_locataire.sql"
  },
  {
    "categorie": "fonction",
    "nom": "finaliser_abonnement_fedapay",
    "migration": "20261015190840_finaliser_abonnements_fedapay_atomiquement.sql"
  },
  {
    "categorie": "fonction",
    "nom": "finances_paiement_locatif",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "generer_code_parrainage",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "fonction",
    "nom": "generer_reference_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "fonction",
    "nom": "gerer_nouvel_utilisateur",
    "migration": "20260919000800_inscription_candidat.sql"
  },
  {
    "categorie": "fonction",
    "nom": "inventaire_schema",
    "migration": "20260824000200_inventaire_schema_auth.sql"
  },
  {
    "categorie": "fonction",
    "nom": "liberer_emission_quittance",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "lieux_publies",
    "migration": "20260919000600_find_recherche.sql"
  },
  {
    "categorie": "fonction",
    "nom": "lire_quittance_autorisee",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "ma_quittance",
    "migration": "20260913000700_acces_locataire.sql"
  },
  {
    "categorie": "fonction",
    "nom": "mes_baux",
    "migration": "20260913000700_acces_locataire.sql"
  },
  {
    "categorie": "fonction",
    "nom": "mes_candidatures",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "fonction",
    "nom": "mes_echeances",
    "migration": "20260913000700_acces_locataire.sql"
  },
  {
    "categorie": "fonction",
    "nom": "mes_paiements",
    "migration": "20260913000700_acces_locataire.sql"
  },
  {
    "categorie": "fonction",
    "nom": "mes_preferences",
    "migration": "20260913000900_notifications_locataire.sql"
  },
  {
    "categorie": "fonction",
    "nom": "mes_roles",
    "migration": "20260919000800_inscription_candidat.sql"
  },
  {
    "categorie": "fonction",
    "nom": "nom_public",
    "migration": "20260919000200_annonces_publiques.sql"
  },
  {
    "categorie": "fonction",
    "nom": "notifier_candidature",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "fonction",
    "nom": "photo_publiee",
    "migration": "20260919000400_find_catalogue.sql"
  },
  {
    "categorie": "fonction",
    "nom": "photos_publiees",
    "migration": "20260919000500_find_detail.sql"
  },
  {
    "categorie": "fonction",
    "nom": "preparer_emission_quittance",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "profil_public_bailleur",
    "migration": "20260919000200_annonces_publiques.sql"
  },
  {
    "categorie": "fonction",
    "nom": "prolonger_abonnement",
    "migration": "20261015190840_finaliser_abonnements_fedapay_atomiquement.sql"
  },
  {
    "categorie": "fonction",
    "nom": "proteger_derniere_photo",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "fonction",
    "nom": "proteger_paiement_fige",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "fonction",
    "nom": "proteger_suppression_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "fonction",
    "nom": "proteger_suppression_paiement_fige",
    "migration": "20260920000100_integrite_suppressions.sql"
  },
  {
    "categorie": "fonction",
    "nom": "publier_emission_quittance",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "purger_codes_verification",
    "migration": "20260913000100_verification_coordonnees.sql"
  },
  {
    "categorie": "fonction",
    "nom": "purger_donnees_personnelles",
    "migration": "20260817000800_cycle_de_grace.sql"
  },
  {
    "categorie": "fonction",
    "nom": "purger_invitations",
    "migration": "20260913000500_invitations_locataire.sql"
  },
  {
    "categorie": "fonction",
    "nom": "reactiver_abonnement",
    "migration": "20260817000800_cycle_de_grace.sql"
  },
  {
    "categorie": "fonction",
    "nom": "refuser_modification_signature",
    "migration": "20260912000500_signatures_apposees.sql"
  },
  {
    "categorie": "fonction",
    "nom": "refuser_suppression_signature",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "reinitialiser_verification_bailleur",
    "migration": "20260920000400_reinit_verification_telephone_bailleur.sql"
  },
  {
    "categorie": "fonction",
    "nom": "reinitialiser_verification_candidat",
    "migration": "20260920000300_verification_telephone_candidat.sql"
  },
  {
    "categorie": "fonction",
    "nom": "repondre_candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "fonction",
    "nom": "reserver_notification",
    "migration": "20261016112439_fiabiliser_files_notifications.sql"
  },
  {
    "categorie": "fonction",
    "nom": "retirer_candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "fonction",
    "nom": "soumettre_candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "fonction",
    "nom": "telephone_canonique",
    "migration": "20260912000600_telephones_canoniques.sql"
  },
  {
    "categorie": "fonction",
    "nom": "terminer_notification",
    "migration": "20261016112439_fiabiliser_files_notifications.sql"
  },
  {
    "categorie": "fonction",
    "nom": "toucher_mis_a_jour_le",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "fonction",
    "nom": "verifier_annonce_candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "fonction",
    "nom": "verifier_coherence_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "fonction",
    "nom": "verifier_coherence_bail",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "fonction",
    "nom": "verifier_coherence_paiement",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "fonction",
    "nom": "verifier_publication_annonce",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "fonction",
    "nom": "verifier_transition_candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "fonction",
    "nom": "verrou_paiements_locatifs",
    "migration": "20261015193157_fiabiliser_paiements_fractionnes_documents.sql"
  },
  {
    "categorie": "fonction",
    "nom": "whatsapp_du_bailleur",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "fonction",
    "nom": "whatsapp_du_candidat",
    "migration": "20260920000300_verification_telephone_candidat.sql"
  },
  {
    "categorie": "index",
    "nom": "abonnements_reference_fedapay_unique",
    "migration": "20261015190840_finaliser_abonnements_fedapay_atomiquement.sql"
  },
  {
    "categorie": "index",
    "nom": "abonnements_transactions_bailleur_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "annonces_bailleur_id_idx",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "index",
    "nom": "annonces_statut_loyer_idx",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "index",
    "nom": "annonces_statut_publiee_le_idx",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "index",
    "nom": "annonces_statut_ville_idx",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "index",
    "nom": "annonces_une_vivante_par_logement",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "index",
    "nom": "bailleurs_cycle_grace_idx",
    "migration": "20260817000800_cycle_de_grace.sql"
  },
  {
    "categorie": "index",
    "nom": "bailleurs_parrain_id_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "baux_bailleur_id_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "baux_locataire_id_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "baux_logement_id_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "baux_un_seul_actif_par_logement",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "candidatures_annonce_idx",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "index",
    "nom": "candidatures_candidat_idx",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "index",
    "nom": "candidatures_une_par_candidat_et_annonce",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "index",
    "nom": "emails_a_envoyer_en_attente_idx",
    "migration": "20260817000800_cycle_de_grace.sql"
  },
  {
    "categorie": "index",
    "nom": "emails_a_envoyer_unicite_palier",
    "migration": "20260817000800_cycle_de_grace.sql"
  },
  {
    "categorie": "index",
    "nom": "idx_codes_verification_recherche",
    "migration": "20260920000300_verification_telephone_candidat.sql"
  },
  {
    "categorie": "index",
    "nom": "idx_invitations_locataire",
    "migration": "20260913000500_invitations_locataire.sql"
  },
  {
    "categorie": "index",
    "nom": "idx_locataires_compte",
    "migration": "20260913000400_roles_et_compte_locataire.sql"
  },
  {
    "categorie": "index",
    "nom": "inscriptions_guide_email_unique",
    "migration": "20260824000300_inscriptions_guide.sql"
  },
  {
    "categorie": "index",
    "nom": "inscriptions_guide_statut_idx",
    "migration": "20260824000300_inscriptions_guide.sql"
  },
  {
    "categorie": "index",
    "nom": "locataires_bailleur_id_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "logements_bailleur_id_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "notifications_candidature_candidature_idx",
    "migration": "20260919001000_notifications_candidatures.sql"
  },
  {
    "categorie": "index",
    "nom": "notifications_candidature_en_attente_idx",
    "migration": "20260919001000_notifications_candidatures.sql"
  },
  {
    "categorie": "index",
    "nom": "notifications_whatsapp_candidature_idx",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "index",
    "nom": "notifications_whatsapp_en_attente_idx",
    "migration": "20260920000200_notifications_whatsapp.sql"
  },
  {
    "categorie": "index",
    "nom": "paiements_bail_periode_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "paiements_bailleur_id_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "paiements_date_paiement_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "quittances_bailleur_id_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "recompenses_parrainage_parrain_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "index",
    "nom": "signatures_apposees_bailleur_idx",
    "migration": "20260912000500_signatures_apposees.sql"
  },
  {
    "categorie": "index",
    "nom": "tentatives_connexion_email_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur ajoute des photos à ses annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur annule ses invitations",
    "migration": "20260913000600_droits_invitations.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur corrige ses paiements",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur crée ses annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur crée ses baux",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur crée ses locataires",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur crée ses logements",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur dépose sa photo",
    "migration": "20260912000300_photo_profil.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur dépose sa signature",
    "migration": "20260817000500_storage.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur enregistre ses paiements",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur invite ses propres locataires",
    "migration": "20260913000600_droits_invitations.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit les candidatures de ses annonces",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit les photos de ses annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit sa photo",
    "migration": "20260912000300_photo_profil.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit sa signature",
    "migration": "20260817000500_storage.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses baux",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses invitations",
    "migration": "20260913000500_invitations_locataire.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses locataires",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses logements",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses paiements",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses quittances",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses quittances stockées",
    "migration": "20260817000500_storage.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses signatures apposées",
    "migration": "20260912000500_signatures_apposees.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses transactions d'abonnement",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit son propre profil",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur modifie les photos de ses annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur modifie ses annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur modifie ses baux",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur modifie ses locataires",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur modifie ses logements",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur modifie son propre profil",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur remplace sa photo",
    "migration": "20260912000300_photo_profil.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur remplace sa signature",
    "migration": "20260817000500_storage.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur répond aux candidatures de ses annonces",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur retire les photos de ses annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur retire sa photo",
    "migration": "20260912000300_photo_profil.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur supprime sa signature",
    "migration": "20260817000500_storage.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur supprime ses annonces",
    "migration": "20260919000100_annonces.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur supprime ses baux",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur supprime ses locataires",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur supprime ses logements",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur supprime ses paiements",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un candidat crée son profil",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un candidat dépose sa candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un candidat lit ses candidatures",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un candidat lit son profil",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un candidat modifie son profil",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un candidat retire sa candidature",
    "migration": "20260919000700_candidatures.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un parrain lit ses récompenses",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "vue",
    "nom": "v_echeances",
    "migration": "20260913000300_echeances_et_historique.sql"
  },
  {
    "categorie": "vue",
    "nom": "v_impayes",
    "migration": "20260913000300_echeances_et_historique.sql"
  },
  {
    "categorie": "vue",
    "nom": "v_metriques_dashboard",
    "migration": "20260817000400_vues_metier.sql"
  },
  {
    "categorie": "vue",
    "nom": "v_progression_visite",
    "migration": "20260912000100_visite_guidee.sql"
  }
]
