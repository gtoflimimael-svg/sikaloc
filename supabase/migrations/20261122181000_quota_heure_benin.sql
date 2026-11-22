-- Fin d'abonnement appréciée à l'heure du Bénin (FN-03).
--
-- Le quota de logements comparait la date de fin d'abonnement à la date UTC.
-- Le Bénin est en UTC+1 : entre 23 h et minuit, heure de Cotonou, un bailleur
-- dont l'abonnement court encore « aujourd'hui » était jugé sur la veille, et
-- inversement le jour de l'expiration. Le code applicatif utilise la même
-- règle (`dateDuJourBenin`, src/lib/format.ts).
--
-- Corps repris à l'identique de la version en production ; seul le fuseau
-- change.

create or replace function prive.verifier_quota_logements()
returns trigger
language plpgsql
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
     and v_fin >= (pg_catalog.now() at time zone 'Africa/Porto-Novo')::date then
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
