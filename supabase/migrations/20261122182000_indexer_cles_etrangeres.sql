-- Index des clés étrangères signalées par l'analyseur Supabase (DB-01).
--
-- Sans index, une suppression ou une mise à jour côté table référencée
-- parcourt toute la table qui référence, et les jointures par bailleur
-- dégradent avec le volume. Tables encore petites : création simple, sans
-- CONCURRENTLY (incompatible avec la transaction de migration).
--
-- Non traités ici, en attente de la décision sur les données Find (SEC-09) :
-- `annonce_photos_annonce_fkey`, les index Find jamais utilisés, et les deux
-- politiques permissives de `candidatures`.
--
-- Les index « jamais utilisés » hors Find sont conservés : sur un faible
-- volume, le planificateur leur préfère un parcours séquentiel ; ceux sur
-- `bailleur_id` servent les filtres RLS dès que les tables grossissent.

create index if not exists credits_abonnement_bailleur_id_idx
  on prive.credits_abonnement (bailleur_id);
create index if not exists emissions_quittance_acteur_idx
  on prive.emissions_quittance (acteur);
create index if not exists emissions_quittance_quittance_id_idx
  on prive.emissions_quittance (quittance_id);
create index if not exists versions_quittance_bailleur_id_idx
  on prive.versions_quittance (bailleur_id);
create index if not exists baux_historique_declare_par_idx
  on public.baux (historique_declare_par);
create index if not exists invitations_locataire_bailleur_id_idx
  on public.invitations_locataire (bailleur_id);
create index if not exists invitations_locataire_cree_par_idx
  on public.invitations_locataire (cree_par);
create index if not exists recompenses_parrainage_filleul_id_idx
  on public.recompenses_parrainage (filleul_id);
