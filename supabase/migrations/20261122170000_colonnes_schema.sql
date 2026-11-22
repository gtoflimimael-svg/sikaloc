-- Colonnes du schéma public, lues dans le catalogue (fiabilité du contrôle
-- quotidien de schéma).
--
-- Le cron `/api/cron/schema` sondait chaque table et vue via PostgREST avec le
-- rôle service_role. Or `baux_loyers` refuse délibérément la lecture à
-- service_role, et `v_echeances` (security_invoker) la lit : la vue était
-- déclarée « injoignable » chaque nuit, en local comme en production. Une
-- fausse alerte quotidienne finit par masquer la vraie.
--
-- Cette fonction rend la liste des colonnes depuis le catalogue, sans lire une
-- seule ligne de données, quels que soient les droits de lecture des tables.

create or replace function public.colonnes_schema()
returns table (relation text, colonne text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.relname::text, a.attname::text
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
   where n.nspname = 'public'
     and c.relkind in ('r', 'v', 'm', 'p')
     and a.attnum > 0
     and not a.attisdropped
$$;

comment on function public.colonnes_schema() is
  'Colonnes des tables et vues de public, lues dans le catalogue, pour le contrôle quotidien de schéma. Service_role uniquement ; aucune donnée lue.';

revoke all on function public.colonnes_schema() from public, anon, authenticated;
grant execute on function public.colonnes_schema() to service_role;
