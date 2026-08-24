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
    "nom": "bailleurs_avatar_format",
    "migration": "20260819000100_avatars.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "bailleurs_signature_chemin_scope",
    "migration": "20260820000200_signature_chemin_contraint.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "locataires_avatar_format",
    "migration": "20260819000100_avatars.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "locataires_signature_chemin_scope",
    "migration": "20260820000200_signature_chemin_contraint.sql"
  },
  {
    "categorie": "contrainte",
    "nom": "quittances_numero_unique_par_bailleur",
    "migration": "20260817000700_documents_v2_1.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "attribuer_numero_document",
    "migration": "20260817000700_documents_v2_1.sql"
  },
  {
    "categorie": "declencheur",
    "nom": "creer_profil_bailleur",
    "migration": "20260817000200_fonctions_et_triggers.sql"
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
    "nom": "toucher_abonnements_transactions",
    "migration": "20260817000200_fonctions_et_triggers.sql"
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
    "nom": "creer_premier_bail",
    "migration": "20260817000600_onboarding_rpc.sql"
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
    "nom": "generer_code_parrainage",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "fonction",
    "nom": "gerer_nouvel_utilisateur",
    "migration": "20260819000100_avatars.sql"
  },
  {
    "categorie": "fonction",
    "nom": "inventaire_schema",
    "migration": "20260824000200_inventaire_schema_auth.sql"
  },
  {
    "categorie": "fonction",
    "nom": "proteger_paiement_fige",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "fonction",
    "nom": "proteger_suppression_paiement_fige",
    "migration": "20260817000200_fonctions_et_triggers.sql"
  },
  {
    "categorie": "fonction",
    "nom": "purger_donnees_personnelles",
    "migration": "20260817000800_cycle_de_grace.sql"
  },
  {
    "categorie": "fonction",
    "nom": "reactiver_abonnement",
    "migration": "20260817000800_cycle_de_grace.sql"
  },
  {
    "categorie": "fonction",
    "nom": "toucher_mis_a_jour_le",
    "migration": "20260817000200_fonctions_et_triggers.sql"
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
    "categorie": "index",
    "nom": "abonnements_transactions_bailleur_idx",
    "migration": "20260817000100_schema_initial.sql"
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
    "nom": "quittances_bail_id_idx",
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
    "nom": "tentatives_connexion_email_idx",
    "migration": "20260817000100_schema_initial.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur corrige ses paiements",
    "migration": "20260817000300_rls.sql"
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
    "nom": "Un bailleur lit sa signature",
    "migration": "20260817000500_storage.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur lit ses baux",
    "migration": "20260817000300_rls.sql"
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
    "nom": "Un bailleur remplace sa signature",
    "migration": "20260817000500_storage.sql"
  },
  {
    "categorie": "politique",
    "nom": "Un bailleur supprime sa signature",
    "migration": "20260817000500_storage.sql"
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
    "nom": "Un parrain lit ses récompenses",
    "migration": "20260817000300_rls.sql"
  },
  {
    "categorie": "vue",
    "nom": "v_impayes",
    "migration": "20260817000400_vues_metier.sql"
  },
  {
    "categorie": "vue",
    "nom": "v_metriques_dashboard",
    "migration": "20260817000400_vues_metier.sql"
  }
]
