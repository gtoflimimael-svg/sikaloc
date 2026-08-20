-- =============================================================================
-- Sikaloc — Signature du locataire sur la quittance
--
-- Jusqu'ici seule la signature du bailleur figurait sur le document. La
-- quittance vaut décharge : le locataire y reconnaît avoir versé la somme, et
-- sa propre signature a donc sa place à côté de celle du bailleur.
--
-- Le locataire n'a pas de compte Sikaloc (spec §9.2 : pas d'authentification
-- côté locataire) : cette signature est recueillie par le bailleur, en
-- personne, depuis la fiche du locataire — au même titre que sa propre
-- signature en Paramètres. Réutilisée sur chaque quittance de ce locataire :
-- ce n'est pas un paraphe par transaction, comme la signature du bailleur ne
-- l'est pas non plus.
--
-- Stockée dans le bucket `signatures` existant, sous
-- <bailleur_id>/locataires/<locataire_id>.<ext> : le premier segment de chemin
-- reste l'identifiant du bailleur, ce qui la couvre par les policies déjà en
-- place sans qu'il soit nécessaire d'en ajouter.
-- =============================================================================

alter table public.locataires
  add column if not exists signature_chemin text;

comment on column public.locataires.signature_chemin is
  'Chemin dans le bucket storage "signatures" (<bailleur_id>/locataires/<locataire_id>.<ext>). NULL = aucune signature recueillie.';
