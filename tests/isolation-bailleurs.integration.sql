-- Isolation entre bailleurs, rejouée sur une base réelle (OPS-03).
--
-- Pile Supabase locale jetable uniquement : le lanceur
-- `scripts/run-isolated-sql-test.mjs` refuse toute autre cible. Tout se passe
-- dans une transaction annulée à la fin ; aucune fixture ne survit.
--
-- A (Gratuit) tente de lire et d'écrire les données de B (Standard), puis de
-- contourner ses propres limites. Chaque contrôle lève une exception « FAIL »
-- s'il réussit là où il devait échouer. La dernière ligne affiche PASS.

\set ON_ERROR_STOP on
begin;

-- ── Fixtures (rôle propriétaire) ─────────────────────────────────────────────
select gen_random_uuid() as a, gen_random_uuid() as b \gset
insert into auth.users (id, email, raw_user_meta_data) values
  (:'a', 'isolation-a-' || replace(:'a', '-', '') || '@example.invalid', '{"nom":"Bailleur A","telephone":"+22997000011"}'),
  (:'b', 'isolation-b-' || replace(:'b', '-', '') || '@example.invalid', '{"nom":"Bailleur B","telephone":"+22997000012"}');
update public.bailleurs set plan = 'Standard', date_fin_abonnement = current_date + 30 where id = :'b';

insert into public.logements (bailleur_id, adresse, type, ville) values (:'a', 'Logement A', 'Studio', 'Cotonou');
insert into public.logements (bailleur_id, adresse, type, ville) values (:'b', 'Logement B', 'Appartement', 'Cotonou') returning id as lb \gset
insert into public.locataires (bailleur_id, nom, telephone, consentement_donnees, date_consentement)
  values (:'b', 'Locataire B', '+22997000013', true, current_date) returning id as tb \gset
insert into public.baux (bailleur_id, logement_id, locataire_id, loyer_mensuel, date_debut, jour_echeance)
  values (:'b', :'lb', :'tb', 100000, date_trunc('month', current_date)::date - interval '2 months', 5) returning id as bb \gset
insert into public.paiements (bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin, mode_paiement, statut, valide_le)
  values (:'b', :'bb', current_date, 100000, date_trunc('month', current_date)::date,
          (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'Espèces', 'Brouillon', null)
  returning id as pb \gset

select set_config('test.a', :'a', true), set_config('test.b', :'b', true),
       set_config('test.bb', :'bb', true), set_config('test.pb', :'pb', true),
       set_config('test.lb', :'lb', true), set_config('test.tb', :'tb', true);

-- ── A connecté ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', :'a', 'role', 'authenticated')::text, true);
set local role authenticated;

do $$
declare
  b uuid := current_setting('test.b')::uuid;
  bb uuid := current_setting('test.bb')::uuid;
  n bigint;
begin
  -- Le test n'est pas vide : A voit bien ses propres données.
  select count(*) into n from public.logements where bailleur_id = current_setting('test.a')::uuid;
  if n <> 1 then raise exception 'FAIL témoin : A ne voit pas son propre logement (%)', n; end if;

  -- T1 lectures croisées : rien de B ne doit apparaître.
  select count(*) into n from public.bailleurs where id = b;               if n <> 0 then raise exception 'FAIL lecture bailleurs'; end if;
  select count(*) into n from public.logements where bailleur_id = b;      if n <> 0 then raise exception 'FAIL lecture logements'; end if;
  select count(*) into n from public.locataires where bailleur_id = b;     if n <> 0 then raise exception 'FAIL lecture locataires'; end if;
  select count(*) into n from public.baux where bailleur_id = b;           if n <> 0 then raise exception 'FAIL lecture baux'; end if;
  select count(*) into n from public.baux_loyers where bail_id = bb;       if n <> 0 then raise exception 'FAIL lecture baux_loyers'; end if;
  select count(*) into n from public.paiements where bailleur_id = b;      if n <> 0 then raise exception 'FAIL lecture paiements'; end if;
  select count(*) into n from public.quittances where bailleur_id = b;     if n <> 0 then raise exception 'FAIL lecture quittances'; end if;
  select count(*) into n from public.v_echeances where bail_id = bb;       if n <> 0 then raise exception 'FAIL lecture v_echeances'; end if;
  select count(*) into n from public.v_impayes where bail_id = bb;         if n <> 0 then raise exception 'FAIL lecture v_impayes'; end if;
end $$;

-- T2 écritures croisées : 0 ligne touchée ou refus.
do $$
declare
  n bigint;
  refuse boolean;
begin
  update public.logements set ville = 'X' where id = current_setting('test.lb')::uuid;
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL écriture logement de B'; end if;
  update public.locataires set nom = 'X' where id = current_setting('test.tb')::uuid;
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL écriture locataire de B'; end if;
  update public.baux set loyer_mensuel = 1 where id = current_setting('test.bb')::uuid;
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL écriture bail de B'; end if;
  delete from public.baux where id = current_setting('test.bb')::uuid;
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL suppression bail de B'; end if;

  refuse := false;
  begin
    insert into public.logements (bailleur_id, adresse, type, ville) values (current_setting('test.b')::uuid, 'Intrus', 'Studio', 'Cotonou');
  exception when others then refuse := true;
  end;
  if not refuse then raise exception 'FAIL insertion d''un logement au nom de B'; end if;
end $$;

-- T3 fonctions métier sur les objets de B : refus attendu.
do $$
declare
  refuse boolean;
begin
  -- Certaines fonctions répondent « faux » plutôt que d'échouer : leur effet
  -- réel est contrôlé plus bas, depuis le rôle propriétaire.
  begin perform public.supprimer_paiement(current_setting('test.pb')::uuid);
  exception when others then null; end;

  refuse := false;
  begin perform public.creer_paiement_brouillon(current_setting('test.bb')::uuid, current_date, 1000,
          date_trunc('month', current_date)::date, 'Espèces', 'Loyer');
  exception when others then refuse := true; end;
  if not refuse then raise exception 'FAIL creer_paiement_brouillon sur le bail de B'; end if;

  refuse := false;
  begin perform public.corriger_paiement(current_setting('test.pb')::uuid, current_setting('test.bb')::uuid, current_date, 1,
          date_trunc('month', current_date)::date, 'Espèces', 'Loyer');
  exception when others then refuse := true; end;
  if not refuse then raise exception 'FAIL corriger_paiement sur B'; end if;

  refuse := false;
  begin perform public.definir_statut_bail(current_setting('test.bb')::uuid, 'Résilié');
  exception when others then refuse := true; end;
  -- Effet contrôlé plus bas : le bail de B doit rester actif.
end $$;

-- T4 contournements commerciaux et financiers par A sur ses propres données.
do $$
declare
  refuse boolean;
begin
  refuse := false;
  begin update public.bailleurs set plan = 'Standard', date_fin_abonnement = '2099-01-01' where id = current_setting('test.a')::uuid;
  exception when others then refuse := true; end;
  if not refuse then raise exception 'FAIL passage gratuit au plan Standard'; end if;

  refuse := false;
  begin insert into public.quittances (bailleur_id, paiement_id) values (current_setting('test.a')::uuid, current_setting('test.pb')::uuid);
  exception when others then refuse := true; end;
  if not refuse then raise exception 'FAIL insertion directe de quittance'; end if;
end $$;

reset role;

-- T5 anonyme : aucune donnée métier lisible.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare
  n bigint;
  refuse boolean;
begin
  refuse := false;
  begin select count(*) into n from public.bailleurs; if n <> 0 then raise exception 'FAIL anonyme lit bailleurs'; end if;
  exception when insufficient_privilege then refuse := true; end;
  refuse := false;
  begin select count(*) into n from public.paiements; if n <> 0 then raise exception 'FAIL anonyme lit paiements'; end if;
  exception when insufficient_privilege then refuse := true; end;
end $$;
reset role;

-- État final, vu du propriétaire : aucune donnée de B n'a bougé.
do $$
begin
  if not exists (select 1 from public.paiements where id = current_setting('test.pb')::uuid and montant = 100000) then
    raise exception 'FAIL le paiement de B a été supprimé ou modifié';
  end if;
  if not exists (select 1 from public.baux where id = current_setting('test.bb')::uuid and statut = 'Actif' and loyer_mensuel = 100000) then
    raise exception 'FAIL le bail de B a été modifié';
  end if;
  if not exists (select 1 from public.logements where id = current_setting('test.lb')::uuid and ville = 'Cotonou') then
    raise exception 'FAIL le logement de B a été modifié';
  end if;
  if exists (select 1 from public.bailleurs where id = current_setting('test.a')::uuid and plan <> 'Gratuit') then
    raise exception 'FAIL A a changé de plan';
  end if;
end $$;

do $$ begin raise notice 'PASS: isolation bailleurs (lectures, écritures, fonctions, contournements, anonyme); fixtures annulées.'; end $$;
rollback;
