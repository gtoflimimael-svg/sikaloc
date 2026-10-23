-- Nettoyage transactionnel réservé à scripts/demo/local.mjs.
-- Le CLI exécute le fichier comme une requête préparée : tout le nettoyage est
-- donc contenu dans ce seul bloc DO. Une exception annule le bloc entier.
-- Le CLI cible le workdir privé avec --local uniquement.

DO $reconstruire_sikaloc_demo$
DECLARE
  total_auth bigint;
  total_demo bigint;
  ids_demo uuid[];
  nombre_declencheurs integer;
BEGIN
  -- Empêche la création concurrente d’un compte pendant les vérifications et
  -- les suppressions ; le verrou est relâché à la fin de cette transaction.
  EXECUTE 'LOCK TABLE auth.users IN ACCESS EXCLUSIVE MODE';

  SELECT count(*) INTO total_auth FROM auth.users;
  SELECT count(*) INTO total_demo
  FROM auth.users
  WHERE raw_app_meta_data ->> 'sikaloc_demo' = 'sikaloc-demo-v1'
    AND lower(coalesce(email, '')) LIKE '%@sikaloc-demo.test';

  IF total_auth <> total_demo THEN
    RAISE EXCEPTION 'Nettoyage annulé : la base contient un compte qui n’est pas identifié comme Sikaloc Demo.';
  END IF;

  SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO ids_demo
  FROM auth.users
  WHERE raw_app_meta_data ->> 'sikaloc_demo' = 'sikaloc-demo-v1'
    AND lower(coalesce(email, '')) LIKE '%@sikaloc-demo.test';

  SELECT count(*) INTO nombre_declencheurs
  FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgenabled = 'O'
    AND (
      (tgrelid = 'public.paiements'::regclass AND tgname = 'proteger_paiement_fige_delete')
      OR (tgrelid = 'public.signatures_apposees'::regclass AND tgname = 'signatures_apposees_immuable_delete')
      OR (tgrelid = 'public.annonces'::regclass AND tgname = 'proteger_suppression_annonce')
    );

  IF nombre_declencheurs <> 3 THEN
    RAISE EXCEPTION 'Nettoyage annulé : les trois protections attendues ne sont pas toutes actives.';
  END IF;

  -- Neutralisation temporaire, uniquement pour cette suppression de fixtures.
  EXECUTE 'ALTER TABLE public.paiements DISABLE TRIGGER proteger_paiement_fige_delete';
  EXECUTE 'ALTER TABLE public.signatures_apposees DISABLE TRIGGER signatures_apposees_immuable_delete';
  EXECUTE 'ALTER TABLE public.annonces DISABLE TRIGGER proteger_suppression_annonce';

  -- Dépendances : preuve de signature → document → paiement → bail → logement/
  -- locataire. Les dossiers d’annonce/candidature sont supprimés par cascade.
  DELETE FROM public.signatures_apposees WHERE bailleur_id = ANY(ids_demo);
  DELETE FROM public.quittances WHERE bailleur_id = ANY(ids_demo);
  DELETE FROM public.paiements WHERE bailleur_id = ANY(ids_demo);
  DELETE FROM public.annonces WHERE bailleur_id = ANY(ids_demo);
  DELETE FROM public.baux WHERE bailleur_id = ANY(ids_demo);
  DELETE FROM public.locataires WHERE bailleur_id = ANY(ids_demo);
  DELETE FROM public.logements WHERE bailleur_id = ANY(ids_demo);
  DELETE FROM auth.users WHERE id = ANY(ids_demo);

  -- Retour à l’état normal avant la fin du même bloc transactionnel.
  EXECUTE 'ALTER TABLE public.paiements ENABLE TRIGGER proteger_paiement_fige_delete';
  EXECUTE 'ALTER TABLE public.signatures_apposees ENABLE TRIGGER signatures_apposees_immuable_delete';
  EXECUTE 'ALTER TABLE public.annonces ENABLE TRIGGER proteger_suppression_annonce';
END
$reconstruire_sikaloc_demo$;
