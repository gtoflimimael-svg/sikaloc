-- Le loyer initial référence le bail créé. Un déclencheur BEFORE INSERT
-- tente d'écrire cette référence avant que la ligne parente existe, ce qui
-- viole la clé étrangère immédiate de baux_loyers.bail_id.
-- L'historisation intervient après l'insertion du bail, dans la même
-- transaction. La fonction reste partagée avec le déclencheur BEFORE UPDATE.
drop trigger if exists baux_tarif_initial on public.baux;

create trigger baux_tarif_initial
  after insert on public.baux
  for each row execute function prive.enregistrer_tarif_bail();
