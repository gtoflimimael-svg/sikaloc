-- Lot 2A.1 — faire respecter les droits d'écriture et les invariants au niveau
-- PostgreSQL, y compris lorsque l'appelant contourne les formulaires Next.js.

-- RLS reste la frontière de propriété. Ces politiques RESTRICTIVE ajoutent la
-- condition d'écriture sans élargir les policies permissives historiques et
-- sans bloquer la lecture des comptes en lecture seule/suspendus.
do $$
declare t text;
begin
  foreach t in array array['logements', 'locataires', 'baux'] loop
    execute format('drop policy if exists %I on public.%I', 'Ecriture INSERT réservée aux bailleurs autorisés', t);
    execute format('drop policy if exists %I on public.%I', 'Ecriture UPDATE réservée aux bailleurs autorisés', t);
    execute format('drop policy if exists %I on public.%I', 'Ecriture DELETE réservée aux bailleurs autorisés', t);

    execute format($policy$
      create policy %I on public.%I as restrictive for insert to authenticated
      with check (
        (select auth.uid()) = bailleur_id
        and exists (
          select 1 from public.bailleurs b
          where b.id = (select auth.uid())
            and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
        )
      )
    $policy$, 'Ecriture INSERT réservée aux bailleurs autorisés', t);

    execute format($policy$
      create policy %I on public.%I as restrictive for update to authenticated
      using (
        (select auth.uid()) = bailleur_id
        and exists (
          select 1 from public.bailleurs b
          where b.id = (select auth.uid())
            and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
        )
      )
      with check (
        (select auth.uid()) = bailleur_id
        and exists (
          select 1 from public.bailleurs b
          where b.id = (select auth.uid())
            and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
        )
      )
    $policy$, 'Ecriture UPDATE réservée aux bailleurs autorisés', t);

    execute format($policy$
      create policy %I on public.%I as restrictive for delete to authenticated
      using (
        (select auth.uid()) = bailleur_id
        and exists (
          select 1 from public.bailleurs b
          where b.id = (select auth.uid())
            and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
        )
      )
    $policy$, 'Ecriture DELETE réservée aux bailleurs autorisés', t);
  end loop;
end $$;

-- Une nouvelle ligne de bail représente un bail en cours. Les baux résiliés
-- restent créables uniquement par un parcours contrôlé, pas par INSERT direct.
drop policy if exists "Nouveau bail nécessairement actif" on public.baux;
create policy "Nouveau bail nécessairement actif"
  on public.baux as restrictive for insert to authenticated
  with check (statut = 'Actif'::public.statut_bail);

-- Les privilèges par colonne empêchent de détourner une mutation autorisée
-- pour réattribuer une ressource, changer son horodatage ou forger un lien Me.
revoke insert, update, delete on public.logements from public, anon, authenticated;
grant insert (bailleur_id, adresse, type, ville, pays) on public.logements to authenticated;
grant update (adresse, type, ville, pays) on public.logements to authenticated;
grant delete on public.logements to authenticated;

revoke insert, update, delete on public.locataires from public, anon, authenticated;
grant insert (bailleur_id, nom, telephone, email, consentement_donnees, date_consentement, avatar)
  on public.locataires to authenticated;
grant update (nom, telephone, email, avatar, notif_email)
  on public.locataires to authenticated;
grant delete on public.locataires to authenticated;

-- Le chemin d'une signature est une référence de Storage, pas une donnée
-- librement modifiable via PostgREST. Seule l'action serveur authentifiée peut
-- le changer, avec une portée strictement liée au bailleur et au locataire.
create or replace function public.definir_signature_locataire(
  p_locataire_id uuid,
  p_chemin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
begin
  if v_acteur is null then raise exception 'Authentification requise.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.bailleurs b where b.id = v_acteur
      and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
  ) then raise exception 'Écriture non autorisée.' using errcode = '42501'; end if;
  if p_chemin is not null and p_chemin !~ (
    '^' || v_acteur::text || '/locataires/' || p_locataire_id::text || '\.(png|jpe?g|webp)$'
  ) then
    raise exception 'Chemin de signature invalide.' using errcode = '23514';
  end if;

  update public.locataires
     set signature_chemin = p_chemin
   where id = p_locataire_id and bailleur_id = v_acteur;
  if not found then raise exception 'Locataire introuvable ou non autorisé.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.definir_signature_locataire(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.definir_signature_locataire(uuid,text) to authenticated;

revoke insert, update, delete on public.baux from public, anon, authenticated;
grant insert (
  bailleur_id, logement_id, locataire_id, loyer_mensuel, date_debut, date_fin,
  jour_echeance, tolerance_jours, depot_garantie, statut
) on public.baux to authenticated;
grant update (
  logement_id, locataire_id, loyer_mensuel, date_debut, date_fin,
  jour_echeance, tolerance_jours, depot_garantie
) on public.baux to authenticated;
grant delete on public.baux to authenticated;

revoke update (statut) on public.baux from public, anon, authenticated;
create or replace function public.definir_statut_bail(
  p_bail_id uuid,
  p_statut public.statut_bail
)
returns public.statut_bail
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
  v_bail public.baux;
begin
  if v_acteur is null then raise exception 'Authentification requise.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.bailleurs b where b.id = v_acteur
      and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
  ) then raise exception 'Écriture non autorisée.' using errcode = '42501'; end if;
  if p_statut is null then raise exception 'Statut invalide.' using errcode = '23514'; end if;

  select * into v_bail from public.baux b
   where b.id = p_bail_id and b.bailleur_id = v_acteur for update;
  if not found then raise exception 'Bail introuvable ou non autorisé.' using errcode = '42501'; end if;

  if p_statut = 'Résilié'::public.statut_bail then
    update public.baux set statut = p_statut, date_fin = coalesce(date_fin, (pg_catalog.now() at time zone 'UTC')::date)
     where id = p_bail_id and bailleur_id = v_acteur;
  else
    update public.baux set statut = p_statut, date_fin = null
     where id = p_bail_id and bailleur_id = v_acteur;
  end if;
  return p_statut;
end;
$$;
revoke all on function public.definir_statut_bail(uuid,public.statut_bail) from public, anon, authenticated, service_role;
grant execute on function public.definir_statut_bail(uuid,public.statut_bail) to authenticated;

-- Les signatures de bailleur et de locataire ne sont modifiables qu'après une
-- vérification serveur du propriétaire, du statut commercial et du chemin.
revoke update (signature_chemin) on public.bailleurs from public, anon, authenticated;
create or replace function public.definir_signature_bailleur(p_chemin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
begin
  if v_acteur is null then raise exception 'Authentification requise.' using errcode = '42501'; end if;
  if p_chemin is not null and p_chemin !~ (
    '^' || v_acteur::text || '/signature\.(png|jpe?g|webp)$'
  ) then raise exception 'Chemin de signature invalide.' using errcode = '23514'; end if;
  update public.bailleurs b set signature_chemin = p_chemin
   where b.id = v_acteur
     and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement);
  if not found then raise exception 'Écriture non autorisée.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.definir_signature_bailleur(text) from public, anon, authenticated, service_role;
grant execute on function public.definir_signature_bailleur(text) to authenticated;

-- Le client ne peut plus modifier directement les objets de signature lorsqu'un
-- compte est en lecture seule/suspendu. Les autres buckets ne sont pas touchés.
drop policy if exists "Signature active requise à l'insertion" on storage.objects;
drop policy if exists "Signature active requise à la modification" on storage.objects;
drop policy if exists "Signature active requise à la suppression" on storage.objects;
create policy "Signature active requise à l'insertion"
  on storage.objects as restrictive for insert to authenticated
  with check (
    bucket_id <> 'signatures' or exists (
      select 1 from public.bailleurs b where b.id = auth.uid()
        and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
    )
  );
create policy "Signature active requise à la modification"
  on storage.objects as restrictive for update to authenticated
  using (
    bucket_id <> 'signatures' or exists (
      select 1 from public.bailleurs b where b.id = auth.uid()
        and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
    )
  )
  with check (
    bucket_id <> 'signatures' or exists (
      select 1 from public.bailleurs b where b.id = auth.uid()
        and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
    )
  );
create policy "Signature active requise à la suppression"
  on storage.objects as restrictive for delete to authenticated
  using (
    bucket_id <> 'signatures' or exists (
      select 1 from public.bailleurs b where b.id = auth.uid()
        and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
    )
  );

-- Le plafond Gratuit est une invariant concurrent : le contrôle de formulaire
-- seul laissait deux créations simultanées dépasser la limite de deux biens.
create or replace function prive.verifier_quota_logements()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.plan_abonnement;
  v_fin date;
  v_statut public.statut_abonnement;
  v_nombre bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sikaloc:logement:' || new.bailleur_id::text, 0)
  );

  select b.plan, b.date_fin_abonnement, b.statut_abonnement
    into v_plan, v_fin, v_statut
    from public.bailleurs b
   where b.id = new.bailleur_id;

  if not found or v_statut not in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement) then
    raise exception 'Écriture non autorisée.' using errcode = '42501';
  end if;

  if v_plan = 'Standard'::public.plan_abonnement
     and v_fin >= (pg_catalog.now() at time zone 'UTC')::date then
    return new;
  end if;

  select count(*) into v_nombre
    from public.logements l
   where l.bailleur_id = new.bailleur_id;

  if v_nombre >= 2 then
    raise exception 'Le plan Gratuit est limité à deux logements.' using errcode = '23514';
  end if;

  return new;
end;
$$;
revoke all on function prive.verifier_quota_logements() from public, anon, authenticated, service_role;
drop trigger if exists verifier_quota_logements on public.logements;
create trigger verifier_quota_logements
  before insert on public.logements
  for each row execute function prive.verifier_quota_logements();

-- Une ligne Validé ne doit jamais être insérable ni modifiable directement via
-- PostgREST. Le seul passage vers Validé reste preparer_emission_quittance,
-- déjà réservé à service_role et couplé à la préparation du document.
revoke insert, update, delete on public.paiements from public, anon, authenticated;
drop policy if exists "Un bailleur enregistre ses paiements" on public.paiements;
drop policy if exists "Un bailleur corrige ses paiements" on public.paiements;
drop policy if exists "Un bailleur supprime ses paiements" on public.paiements;

create or replace function public.creer_paiement_brouillon(
  p_bail_id uuid,
  p_date_paiement date,
  p_montant numeric,
  p_periode_debut date,
  p_mode_paiement public.mode_paiement,
  p_type_paiement public.type_paiement default 'Loyer'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
  v_bail public.baux;
  v_cumul numeric;
  v_id uuid;
begin
  if v_acteur is null then raise exception 'Authentification requise.' using errcode = '42501'; end if;
  if p_date_paiement is null or p_montant is null or p_montant <= 0
     or p_periode_debut is null or extract(day from p_periode_debut) <> 1
     or p_mode_paiement is null or p_type_paiement is null then
    raise exception 'Données de paiement invalides.' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(72150302);
  if not exists (
    select 1 from public.bailleurs b where b.id = v_acteur
      and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
  ) then raise exception 'Écriture non autorisée.' using errcode = '42501'; end if;

  select * into v_bail from public.baux b
   where b.id = p_bail_id and b.bailleur_id = v_acteur for share;
  if not found or not exists (
    select 1 from public.logements l join public.locataires t on t.id = v_bail.locataire_id
     where l.id = v_bail.logement_id and l.bailleur_id = v_acteur and t.bailleur_id = v_acteur
  ) then raise exception 'Bail introuvable ou non autorisé.' using errcode = '42501'; end if;

  select coalesce(sum(p.montant), 0) into v_cumul from public.paiements p
   where p.bail_id = p_bail_id and p.bailleur_id = v_acteur
     and p.periode_debut = p_periode_debut and p.type_paiement = 'Loyer'::public.type_paiement
     and p.statut = 'Validé'::public.statut_paiement;

  insert into public.paiements (
    bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin,
    mode_paiement, type_paiement, est_partiel, statut, valide_le, historique
  ) values (
    v_acteur, p_bail_id, p_date_paiement, p_montant, p_periode_debut,
    (p_periode_debut + interval '1 month - 1 day')::date,
    p_mode_paiement, p_type_paiement,
    p_type_paiement = 'Loyer'::public.type_paiement and v_cumul + p_montant < v_bail.loyer_mensuel,
    'Brouillon'::public.statut_paiement, null, false
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.corriger_paiement(
  p_paiement_id uuid,
  p_bail_id uuid,
  p_date_paiement date,
  p_montant numeric,
  p_periode_debut date,
  p_mode_paiement public.mode_paiement,
  p_type_paiement public.type_paiement
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
  v_paiement public.paiements;
  v_bail public.baux;
  v_cumul numeric;
begin
  if v_acteur is null then raise exception 'Authentification requise.' using errcode = '42501'; end if;
  if p_date_paiement is null or p_montant is null or p_montant <= 0
     or p_periode_debut is null or extract(day from p_periode_debut) <> 1
     or p_mode_paiement is null or p_type_paiement is null then
    raise exception 'Données de paiement invalides.' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(72150302);
  if not exists (
    select 1 from public.bailleurs b where b.id = v_acteur
      and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
  ) then raise exception 'Écriture non autorisée.' using errcode = '42501'; end if;

  select * into v_paiement from public.paiements p
   where p.id = p_paiement_id and p.bailleur_id = v_acteur for update;
  if not found or v_paiement.historique then
    raise exception 'Paiement introuvable, historique ou non autorisé.' using errcode = '42501';
  end if;
  if v_paiement.statut = 'Validé'::public.statut_paiement
     and (v_paiement.valide_le is null or v_paiement.valide_le < now() - interval '5 minutes') then
    raise exception 'Ce paiement est figé : la fenêtre de correction de 5 minutes est écoulée.' using errcode = '23514';
  end if;

  select * into v_bail from public.baux b
   where b.id = p_bail_id and b.bailleur_id = v_acteur for share;
  if not found or not exists (
    select 1 from public.logements l join public.locataires t on t.id = v_bail.locataire_id
     where l.id = v_bail.logement_id and l.bailleur_id = v_acteur and t.bailleur_id = v_acteur
  ) then raise exception 'Bail introuvable ou non autorisé.' using errcode = '42501'; end if;

  select coalesce(sum(p.montant), 0) into v_cumul from public.paiements p
   where p.bail_id = p_bail_id and p.bailleur_id = v_acteur and p.id <> p_paiement_id
     and p.periode_debut = p_periode_debut and p.type_paiement = 'Loyer'::public.type_paiement
     and p.statut = 'Validé'::public.statut_paiement;

  update public.paiements set
    bail_id = p_bail_id,
    date_paiement = p_date_paiement,
    montant = p_montant,
    periode_debut = p_periode_debut,
    periode_fin = (p_periode_debut + interval '1 month - 1 day')::date,
    mode_paiement = p_mode_paiement,
    type_paiement = p_type_paiement,
    est_partiel = p_type_paiement = 'Loyer'::public.type_paiement
      and v_cumul + p_montant < v_bail.loyer_mensuel,
    statut = 'Brouillon'::public.statut_paiement,
    valide_le = null
  where id = p_paiement_id and bailleur_id = v_acteur;
  return p_paiement_id;
end;
$$;

create or replace function public.supprimer_paiement(p_paiement_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
  v_paiement public.paiements;
begin
  if v_acteur is null then raise exception 'Authentification requise.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(72150302);
  if not exists (
    select 1 from public.bailleurs b where b.id = v_acteur
      and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
  ) then raise exception 'Écriture non autorisée.' using errcode = '42501'; end if;

  select * into v_paiement from public.paiements p
   where p.id = p_paiement_id and p.bailleur_id = v_acteur for update;
  if not found then return false; end if;
  delete from public.paiements where id = v_paiement.id and bailleur_id = v_acteur;
  return found;
end;
$$;

-- L'import historique reste possible, mais la création des paiements et le
-- marqueur qui change la lecture des échéances deviennent atomiques. Les mois
-- doivent encore être déclarables au moment de l'écriture.
create or replace function public.declarer_paiements_historiques(
  p_bail_id uuid,
  p_periodes date[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acteur uuid := auth.uid();
  v_bail public.baux;
  v_insere integer;
begin
  if v_acteur is null then raise exception 'Authentification requise.' using errcode = '42501'; end if;
  if p_periodes is null
     or array_position(p_periodes, null::date) is not null
     or cardinality(p_periodes) <> (
       select count(distinct u.periode) from unnest(p_periodes) as u(periode)
     ) then
    raise exception 'Périodes historiques invalides.' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(72150302);
  select * into v_bail from public.baux b
   where b.id = p_bail_id and b.bailleur_id = v_acteur for update;
  if not found then raise exception 'Bail introuvable ou non autorisé.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.bailleurs b where b.id = v_acteur
      and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
  ) then raise exception 'Écriture non autorisée.' using errcode = '42501'; end if;
  if v_bail.historique_declare_le is not null then
    raise exception 'L''historique de ce bail est déjà déclaré.' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(p_periodes) as u(periode)
     where not exists (
       select 1 from public.v_echeances e
        where e.bail_id = p_bail_id and e.bailleur_id = v_acteur
          and e.periode_debut = u.periode and e.anterieure and e.etat <> 'Réglé'
     )
  ) then raise exception 'Une période n''est plus déclarable.' using errcode = '23514'; end if;

  insert into public.paiements (
    bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin,
    mode_paiement, type_paiement, est_partiel, statut, valide_le, historique
  )
  select v_acteur, p_bail_id, null, e.loyer_mensuel, e.periode_debut, e.periode_fin,
         'Espèces'::public.mode_paiement, 'Loyer'::public.type_paiement, false,
         'Validé'::public.statut_paiement, pg_catalog.now(), true
    from public.v_echeances e
    join unnest(p_periodes) as u(periode) on u.periode = e.periode_debut
   where e.bail_id = p_bail_id and e.bailleur_id = v_acteur
     and e.anterieure and e.etat <> 'Réglé';
  get diagnostics v_insere = row_count;
  if v_insere <> cardinality(p_periodes) then
    raise exception 'Les périodes historiques ont changé; recommencez.' using errcode = '40001';
  end if;

  update public.baux set historique_declare_le = pg_catalog.now(), historique_declare_par = v_acteur
   where id = p_bail_id and bailleur_id = v_acteur and historique_declare_le is null;
  if not found then raise exception 'L''historique de ce bail a changé; recommencez.' using errcode = '40001'; end if;
  return v_insere;
end;
$$;

revoke all on function public.creer_paiement_brouillon(uuid,date,numeric,date,public.mode_paiement,public.type_paiement)
  from public, anon, authenticated, service_role;
grant execute on function public.creer_paiement_brouillon(uuid,date,numeric,date,public.mode_paiement,public.type_paiement)
  to authenticated;
revoke all on function public.corriger_paiement(uuid,uuid,date,numeric,date,public.mode_paiement,public.type_paiement)
  from public, anon, authenticated, service_role;
grant execute on function public.corriger_paiement(uuid,uuid,date,numeric,date,public.mode_paiement,public.type_paiement)
  to authenticated;
revoke all on function public.supprimer_paiement(uuid) from public, anon, authenticated, service_role;
grant execute on function public.supprimer_paiement(uuid) to authenticated;
revoke all on function public.declarer_paiements_historiques(uuid,date[]) from public, anon, authenticated, service_role;
grant execute on function public.declarer_paiements_historiques(uuid,date[]) to authenticated;
