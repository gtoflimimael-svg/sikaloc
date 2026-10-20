-- Lot 2A.2 — conserve le tarif de chaque bail par période mensuelle.
-- Les tarifs antérieurs à cette migration ne peuvent pas être reconstruits
-- depuis les anciennes lignes : le tarif courant sert de point de départ.

create table if not exists public.baux_loyers (
  bail_id uuid not null references public.baux(id) on delete cascade,
  periode_debut date not null,
  loyer_mensuel numeric(12, 2) not null,
  cree_le timestamptz not null default now(),
  constraint baux_loyers_pkey primary key (bail_id, periode_debut),
  constraint baux_loyers_loyer_positif check (loyer_mensuel > 0),
  constraint baux_loyers_periode_est_mensuelle
    check (extract(day from periode_debut) = 1)
);

comment on table public.baux_loyers is
  'Historique du loyer contractuel, effectif à partir du premier jour de chaque période mensuelle.';

alter table public.baux_loyers enable row level security;
drop policy if exists baux_loyers_lecture_proprietaire on public.baux_loyers;
create policy baux_loyers_lecture_proprietaire
  on public.baux_loyers for select to authenticated
  using (exists (
    select 1 from public.baux b
     where b.id = bail_id
       and b.bailleur_id = (select auth.uid())
  ));

revoke all on public.baux_loyers from public, anon, authenticated, service_role;
grant select on public.baux_loyers to authenticated;

-- Point de départ conservateur : le schéma antérieur ne gardait pas les
-- anciennes valeurs. Le tarif actuel est donc recopié à partir du début du bail.
insert into public.baux_loyers (bail_id, periode_debut, loyer_mensuel)
select b.id, date_trunc('month', b.date_debut::timestamp)::date, b.loyer_mensuel
  from public.baux b
on conflict (bail_id, periode_debut) do nothing;

create or replace function prive.loyer_bail_pour_periode(
  p_bail_id uuid,
  p_periode date,
  p_loyer_defaut numeric
) returns numeric
language sql stable security invoker set search_path = '' as $$
  select coalesce(
    (
      select h.loyer_mensuel
        from public.baux_loyers h
       where h.bail_id = p_bail_id
         and h.periode_debut <= p_periode - (extract(day from p_periode)::int - 1)
       order by h.periode_debut desc
       limit 1
    ),
    p_loyer_defaut
  );
$$;
revoke all on function prive.loyer_bail_pour_periode(uuid, date, numeric)
  from public, anon, authenticated, service_role;

create or replace function prive.enregistrer_tarif_bail()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_periode date;
begin
  if tg_op = 'INSERT' then
    insert into public.baux_loyers (bail_id, periode_debut, loyer_mensuel)
    values (
      new.id,
      date_trunc('month', new.date_debut::timestamp)::date,
      new.loyer_mensuel
    )
    on conflict (bail_id, periode_debut) do nothing;
    return new;
  end if;

  if new.loyer_mensuel is distinct from old.loyer_mensuel then
    if old.statut = 'Résilié'::public.statut_bail then
      raise exception 'Le loyer d’un bail résilié ne peut plus être modifié.'
        using errcode = '23514';
    end if;

    v_periode := greatest(
      date_trunc('month', current_date::timestamp)::date,
      date_trunc('month', new.date_debut::timestamp)::date
    );

    if new.date_fin is not null
       and v_periode > date_trunc('month', new.date_fin::timestamp)::date then
      raise exception 'Aucune nouvelle période de loyer ne peut être définie après la fin du bail.'
        using errcode = '23514';
    end if;

    if exists (
      select 1 from public.paiements p
       where p.bail_id = new.id
         and p.periode_debut = v_periode
         and p.type_paiement = 'Loyer'::public.type_paiement
    ) then
      raise exception 'Le loyer ne peut pas être modifié après la saisie d’un versement pour cette période.'
        using errcode = '23514';
    end if;

    insert into public.baux_loyers (bail_id, periode_debut, loyer_mensuel)
    values (new.id, v_periode, new.loyer_mensuel)
    on conflict (bail_id, periode_debut)
    do update set loyer_mensuel = excluded.loyer_mensuel;
  end if;

  return new;
end;
$$;
revoke all on function prive.enregistrer_tarif_bail()
  from public, anon, authenticated, service_role;

drop trigger if exists baux_tarif_initial on public.baux;
create trigger baux_tarif_initial
  before insert on public.baux
  for each row execute function prive.enregistrer_tarif_bail();

drop trigger if exists baux_tarif_nouvelle_periode on public.baux;
create trigger baux_tarif_nouvelle_periode
  before update of loyer_mensuel on public.baux
  for each row execute function prive.enregistrer_tarif_bail();

comment on function prive.enregistrer_tarif_bail() is
  'Enregistre le tarif d’un bail à sa création et applique les changements à la période courante, sans réécrire les mois antérieurs.';

-- La vue reste la source unique des échéances pour Pro et Me. Un bail résilié
-- conserve les mois jusqu’à date_fin, mais ne crée aucune période au-delà.
create or replace view public.v_echeances
  with (security_invoker = true) as
with periodes as (
  select
    b.id as bail_id,
    b.bailleur_id,
    b.locataire_id,
    b.logement_id,
    coalesce(tarif.loyer_mensuel, b.loyer_mensuel) as loyer_mensuel,
    b.jour_echeance::int as jour_echeance,
    b.tolerance_jours::int as tolerance_jours,
    b.created_at::date as enregistre_le,
    b.historique_declare_le,
    serie::date as periode_debut
  from public.baux b
  cross join lateral generate_series(
    date_trunc('month', b.date_debut::timestamp),
    date_trunc('month', coalesce(b.date_fin, current_date)::timestamp),
    interval '1 month'
  ) as serie
  left join lateral (
    select h.loyer_mensuel
      from public.baux_loyers h
     where h.bail_id = b.id
       and h.periode_debut <= serie::date
     order by h.periode_debut desc
     limit 1
  ) tarif on true
  where b.statut in ('Actif'::public.statut_bail, 'Résilié'::public.statut_bail)
),
echeances as (
  select
    p.*,
    (p.periode_debut + interval '1 month' - interval '1 day')::date as periode_fin,
    make_date(
      extract(year from p.periode_debut)::int,
      extract(month from p.periode_debut)::int,
      least(
        p.jour_echeance,
        extract(day from (p.periode_debut + interval '1 month' - interval '1 day'))::int
      )
    ) as date_echeance
  from periodes p
)
select
  e.bail_id,
  e.bailleur_id,
  e.locataire_id,
  e.logement_id,
  e.periode_debut,
  e.periode_fin,
  e.date_echeance,
  e.loyer_mensuel,
  e.tolerance_jours,
  coalesce(regle.montant_paye, 0) as montant_paye,
  greatest(0, e.loyer_mensuel - coalesce(regle.montant_paye, 0)) as montant_du,
  (current_date - e.date_echeance)::int as jours_de_retard,
  (e.date_echeance + e.tolerance_jours < e.enregistre_le) as anterieure,
  (e.historique_declare_le is not null) as historique_declare,
  case
    when coalesce(regle.montant_paye, 0) >= e.loyer_mensuel then 'Réglé'
    when current_date <= e.date_echeance + e.tolerance_jours then 'À venir'
    when e.date_echeance + e.tolerance_jours < e.enregistre_le
         and e.historique_declare_le is null then 'À déterminer'
    else 'Impayé'
  end as etat,
  locataire.nom as locataire_nom,
  locataire.telephone as locataire_telephone,
  logement.adresse as logement_adresse,
  logement.ville as logement_ville,
  greatest(0, coalesce(regle.montant_paye, 0) - e.loyer_mensuel) as montant_excedentaire
from echeances e
join public.locataires locataire on locataire.id = e.locataire_id
join public.logements logement on logement.id = e.logement_id
left join lateral (
  select sum(pa.montant) as montant_paye
    from public.paiements pa
   where pa.bail_id = e.bail_id
     and pa.statut = 'Validé'::public.statut_paiement
     and pa.type_paiement = 'Loyer'::public.type_paiement
     and pa.periode_debut = e.periode_debut
) regle on true;

comment on view public.v_echeances is
  'Une ligne par période de bail actif ou résilié jusqu’à sa date de fin. Les loyers historiques viennent de baux_loyers; montant_du ne devient jamais négatif et montant_excedentaire n’est pas reporté automatiquement.';

-- Le tableau de bord doit utiliser le tarif de la période, et non la dernière
-- valeur saisie sur le bail pour tous les mois.
create or replace view public.v_metriques_dashboard
  with (security_invoker = true) as
select
  b.id as bailleur_id,
  (select count(*) from public.logements l where l.bailleur_id = b.id) as nb_logements,
  (select count(*) from public.baux ba
    where ba.bailleur_id = b.id and ba.statut = 'Actif') as nb_baux_actifs,
  case
    when (select count(*) from public.logements l where l.bailleur_id = b.id) = 0 then 0::numeric
    else round(
      (select count(*) from public.baux ba
        where ba.bailleur_id = b.id and ba.statut = 'Actif')::numeric * 100
      / (select count(*) from public.logements l where l.bailleur_id = b.id)::numeric,
      1
    )
  end as taux_occupation,
  coalesce((
    select sum(coalesce(
      (select h.loyer_mensuel
         from public.baux_loyers h
        where h.bail_id = ba.id
          and h.periode_debut <= date_trunc('month', current_date::timestamp)::date
        order by h.periode_debut desc
        limit 1),
      ba.loyer_mensuel
    ))
      from public.baux ba
     where ba.bailleur_id = b.id
       and ba.statut = 'Actif'
       and date_trunc('month', ba.date_debut::timestamp)
           <= date_trunc('month', current_date::timestamp)
       and (ba.date_fin is null
            or ba.date_fin >= date_trunc('month', current_date::timestamp)::date)
  ), 0) as loyers_attendus_mois,
  coalesce((
    select sum(pa.montant)
      from public.paiements pa
     where pa.bailleur_id = b.id
       and pa.statut = 'Validé'
       and pa.type_paiement = 'Loyer'
       and pa.periode_debut = date_trunc('month', current_date::timestamp)::date
  ), 0) as loyers_percus_mois,
  coalesce((
    select sum(pa.montant)
      from public.paiements pa
     where pa.bailleur_id = b.id
       and pa.statut = 'Validé'
       and pa.date_paiement >= date_trunc('month', current_date::timestamp)::date
       and pa.date_paiement < (date_trunc('month', current_date::timestamp) + interval '1 month')::date
  ), 0) as ca_du_mois,
  (select count(*) from public.v_impayes i where i.bailleur_id = b.id) as nb_impayes,
  coalesce((select sum(i.montant_du) from public.v_impayes i where i.bailleur_id = b.id), 0)
    as montant_impaye_total
from public.bailleurs b;

comment on view public.v_metriques_dashboard is
  'Métriques du tableau de bord; les loyers attendus sont valorisés au tarif applicable au mois courant.';
grant select on public.v_metriques_dashboard to authenticated;

-- Un paiement excédentaire reste attaché à son mois. Aucun crédit n’est
-- silencieusement affecté au mois suivant; il est rendu visible séparément.
drop function if exists public.mes_echeances();
create function public.mes_echeances()
returns table (
  bail_id uuid,
  periode_debut date,
  periode_fin date,
  date_echeance date,
  loyer_mensuel numeric,
  montant_paye numeric,
  montant_du numeric,
  jours_de_retard int,
  etat text,
  montant_excedentaire numeric
)
language sql stable security definer set search_path = '' as $$
  select e.bail_id, e.periode_debut, e.periode_fin, e.date_echeance,
         e.loyer_mensuel, e.montant_paye, e.montant_du, e.jours_de_retard,
         e.etat, e.montant_excedentaire
    from public.v_echeances e
   where e.locataire_id in (select prive.fiches_du_compte())
   order by e.periode_debut;
$$;
comment on function public.mes_echeances() is
  'Échéances du locataire appelant calculées par v_echeances, y compris les excédents non reportés.';
revoke all on function public.mes_echeances() from public, anon;
grant execute on function public.mes_echeances() to authenticated;

-- Une période de paiement utilise le loyer effectif à ce mois, y compris pour
-- les documents historiques sans snapshot. Les snapshots valides demeurent la
-- source d’autorité pour les documents déjà publiés.
create or replace function prive.finances_paiement_locatif_a_date(
  p public.paiements,
  p_loyer numeric,
  p_date_reference timestamptz
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  f jsonb;
  cumul numeric;
  versements jsonb;
  v_loyer numeric;
begin
  if p.id is null or p_date_reference is null then return null; end if;

  select e.finances into f
    from prive.finances_emission e
   where e.paiement_id = p.id
     and e.empreinte_paiement = prive.empreinte_paiement_locatif(p)
     and not exists (
       select 1
         from jsonb_array_elements(e.finances->'versements') v
         left join public.paiements x on x.id = (v->>'id')::uuid
        where x.id is null
           or encode(prive.empreinte_paiement_locatif(x), 'hex') <> v->>'empreinte'
     );
  if f is not null then return f; end if;

  if p.type_paiement = 'Loyer'::public.type_paiement then
    v_loyer := prive.loyer_bail_pour_periode(p.bail_id, p.periode_debut, p_loyer);
    select coalesce(sum(x.montant), 0),
           coalesce(jsonb_agg(jsonb_build_object(
             'id', x.id,
             'empreinte', encode(prive.empreinte_paiement_locatif(x), 'hex')
           ) order by x.id), '[]'::jsonb)
      into cumul, versements
      from public.paiements x
     where x.bail_id = p.bail_id
       and x.bailleur_id = p.bailleur_id
       and x.periode_debut = p.periode_debut
       and x.type_paiement = 'Loyer'::public.type_paiement
       and x.statut = 'Validé'::public.statut_paiement
       and x.valide_le <= p_date_reference;
  else
    v_loyer := 0;
    cumul := 0;
    versements := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'empreinte_paiement', encode(prive.empreinte_paiement_locatif(p), 'hex'),
    'montant', p.montant,
    'cumul_loyer', cumul,
    'loyer_mensuel', v_loyer,
    'solde_restant', greatest(0, v_loyer - cumul),
    'trop_percu', greatest(0, cumul - v_loyer),
    'est_partiel', p.type_paiement = 'Loyer'::public.type_paiement and cumul < v_loyer,
    'periode_debut', p.periode_debut,
    'periode_fin', p.periode_fin,
    'date_paiement', p.date_paiement,
    'mode_paiement', p.mode_paiement,
    'type_paiement', p.type_paiement,
    'versements', versements
  );
end;
$$;
revoke all on function prive.finances_paiement_locatif_a_date(public.paiements, numeric, timestamptz)
  from public, anon, authenticated, service_role;

create or replace function prive.finances_paiement_locatif(p public.paiements, loyer numeric)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select prive.finances_paiement_locatif_a_date(p, loyer, now());
$$;
revoke all on function prive.finances_paiement_locatif(public.paiements, numeric)
  from public, anon, authenticated, service_role;

-- Les créations/corrections de brouillons utilisent le même tarif de période
-- que la vue, sans changer le parcours ni ses contrôles de propriété.
create or replace function public.creer_paiement_brouillon(
  p_bail_id uuid,
  p_date_paiement date,
  p_montant numeric,
  p_periode_debut date,
  p_mode_paiement public.mode_paiement,
  p_type_paiement public.type_paiement default 'Loyer'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_acteur uuid := auth.uid();
  v_bail public.baux;
  v_cumul numeric;
  v_loyer numeric;
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

  v_loyer := prive.loyer_bail_pour_periode(v_bail.id, p_periode_debut, v_bail.loyer_mensuel);
  select coalesce(sum(p.montant), 0) into v_cumul
    from public.paiements p
   where p.bail_id = p_bail_id and p.bailleur_id = v_acteur
     and p.periode_debut = p_periode_debut
     and p.type_paiement = 'Loyer'::public.type_paiement
     and p.statut = 'Validé'::public.statut_paiement;

  insert into public.paiements (
    bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin,
    mode_paiement, type_paiement, est_partiel, statut, valide_le, historique
  ) values (
    v_acteur, p_bail_id, p_date_paiement, p_montant, p_periode_debut,
    (p_periode_debut + interval '1 month - 1 day')::date,
    p_mode_paiement, p_type_paiement,
    p_type_paiement = 'Loyer'::public.type_paiement and v_cumul + p_montant < v_loyer,
    'Brouillon'::public.statut_paiement, null, false
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.creer_paiement_brouillon(uuid, date, numeric, date, public.mode_paiement, public.type_paiement)
  from public, anon, authenticated, service_role;
grant execute on function public.creer_paiement_brouillon(uuid, date, numeric, date, public.mode_paiement, public.type_paiement)
  to authenticated;

create or replace function public.corriger_paiement(
  p_paiement_id uuid,
  p_bail_id uuid,
  p_date_paiement date,
  p_montant numeric,
  p_periode_debut date,
  p_mode_paiement public.mode_paiement,
  p_type_paiement public.type_paiement
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_acteur uuid := auth.uid();
  v_paiement public.paiements;
  v_bail public.baux;
  v_cumul numeric;
  v_loyer numeric;
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

  v_loyer := prive.loyer_bail_pour_periode(v_bail.id, p_periode_debut, v_bail.loyer_mensuel);
  select coalesce(sum(p.montant), 0) into v_cumul
    from public.paiements p
   where p.bail_id = p_bail_id and p.bailleur_id = v_acteur
     and p.id <> p_paiement_id and p.periode_debut = p_periode_debut
     and p.type_paiement = 'Loyer'::public.type_paiement
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
      and v_cumul + p_montant < v_loyer,
    statut = 'Brouillon'::public.statut_paiement,
    valide_le = null
   where id = p_paiement_id and bailleur_id = v_acteur;
  return p_paiement_id;
end;
$$;
revoke all on function public.corriger_paiement(uuid, uuid, date, numeric, date, public.mode_paiement, public.type_paiement)
  from public, anon, authenticated, service_role;
grant execute on function public.corriger_paiement(uuid, uuid, date, numeric, date, public.mode_paiement, public.type_paiement)
  to authenticated;

-- Le modèle de document est déterminé aussi par la nature du versement : une
-- charge ou un dépôt est toujours un reçu, jamais une quittance de loyer.
create or replace function prive.qualifier_document_paiement()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_type public.type_paiement;
begin
  select p.type_paiement into v_type
    from public.paiements p
   where p.id = new.paiement_id;
  if not found then
    raise exception 'Paiement du document introuvable.' using errcode = '23503';
  end if;
  if v_type <> 'Loyer'::public.type_paiement then
    new.type := 'Reçu'::public.type_document;
  end if;
  return new;
end;
$$;
revoke all on function prive.qualifier_document_paiement()
  from public, anon, authenticated, service_role;
drop trigger if exists a_quittances_qualifier_paiement on public.quittances;
create trigger a_quittances_qualifier_paiement
  before insert or update of paiement_id, type on public.quittances
  for each row execute function prive.qualifier_document_paiement();
