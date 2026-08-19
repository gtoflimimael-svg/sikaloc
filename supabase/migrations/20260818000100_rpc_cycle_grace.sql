-- =============================================================================
-- Sikaloc — Déclenchement du cycle de grâce depuis l'application
--
-- pg_cron exécute déjà `prive.appliquer_cycle_grace()` chaque nuit. Ce wrapper
-- permet de le déclencher aussi depuis /api/cron/cycle-grace, ce qui sert à
-- trois choses :
--   - disposer d'un filet si pg_cron est désactivé sur l'instance ;
--   - relancer manuellement le cycle sans ouvrir l'éditeur SQL ;
--   - faire porter la planification par Vercel Cron, avec sa journalisation.
--
-- La double exécution est sans danger : la fonction sous-jacente n'agit que
-- lorsqu'un palier est franchi.
--
-- `prive` n'étant pas exposé au Data API, il faut ce point d'entrée dans
-- `public` — restreint au seul service_role, jamais à anon ni authenticated.
-- =============================================================================

create or replace function public.executer_cycle_grace()
returns table (bailleur uuid, ancien text, nouveau text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select out_bailleur, out_ancien, out_nouveau
      from prive.appliquer_cycle_grace();
end;
$$;

create or replace function public.executer_purge_j90()
returns table (bailleur uuid, locataires integer, fichiers integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select out_bailleur, out_locataires, out_fichiers
      from prive.purger_donnees_personnelles();
end;
$$;

-- Postgres accorde EXECUTE à PUBLIC par défaut : sans ces révocations, ces deux
-- fonctions seraient des endpoints ouverts capables de faire progresser un
-- cycle de grâce, voire de déclencher une purge.
revoke all on function public.executer_cycle_grace() from public, anon, authenticated;
revoke all on function public.executer_purge_j90()   from public, anon, authenticated;

grant execute on function public.executer_cycle_grace() to service_role;
grant execute on function public.executer_purge_j90()   to service_role;

comment on function public.executer_cycle_grace() is
  'Point d''entrée service_role du cycle de grâce. Idempotent.';
comment on function public.executer_purge_j90() is
  'Point d''entrée service_role de la purge J+90, volet base.';
