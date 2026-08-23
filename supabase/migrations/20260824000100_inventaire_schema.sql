-- =============================================================================
-- Sikaloc — inventaire du schéma, pour la surveillance de dérive
-- =============================================================================
--
-- Le contrôle de schéma ne savait comparer que les colonnes, parce que
-- PostgREST n'expose que des tables. Il annonçait donc « conforme » le
-- 24/08/2026 alors que deux contraintes manquaient en production : la migration
-- `20260820000200` n'avait jamais été appliquée.
--
-- Cette fonction ouvre le catalogue Postgres à la seule clé de service, en
-- lecture, et uniquement pour des NOMS d'objets. Elle ne rend aucune donnée
-- métier : ni ligne, ni valeur, ni définition.
--
-- `security definer` est nécessaire — le catalogue n'est pas lisible autrement
-- à travers PostgREST — et s'accompagne des deux garde-fous d'usage :
-- `set search_path = ''`, qui force la qualification complète de chaque
-- référence, et un `revoke` explicite sur tous les rôles applicatifs.

create or replace function public.inventaire_schema()
returns table (categorie text, schema text, nom text)
language sql
stable
security definer
set search_path = ''
as $$
  -- Contraintes : clés, unicité, et surtout les `check` métier, seuls objets
  -- qui portent une règle sans être visibles depuis l'API.
  select 'contrainte', n.nspname::text, c.conname::text
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_namespace n on n.oid = c.connamespace
   where n.nspname in ('public', 'prive', 'storage')

  union all

  select 'politique', p.schemaname::text, p.policyname::text
    from pg_catalog.pg_policies p
   where p.schemaname in ('public', 'prive', 'storage')

  union all

  select 'fonction', n.nspname::text, p.proname::text
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'prive')

  union all

  select 'vue', v.schemaname::text, v.viewname::text
    from pg_catalog.pg_views v
   where v.schemaname in ('public', 'prive')

  union all

  select 'index', i.schemaname::text, i.indexname::text
    from pg_catalog.pg_indexes i
   where i.schemaname in ('public', 'prive', 'storage')

  union all

  -- `tgisinternal` écarte les déclencheurs que Postgres crée lui-même pour
  -- appliquer les clés étrangères : ils ne figurent dans aucune migration.
  select 'declencheur', n.nspname::text, t.tgname::text
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class cl on cl.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = cl.relnamespace
   where n.nspname in ('public', 'prive')
     and not t.tgisinternal
$$;

comment on function public.inventaire_schema() is
  'Noms des objets de schéma, pour le contrôle de dérive. Réservée à service_role ; ne rend aucune donnée métier.';

-- Aucun rôle applicatif n'a à connaître la structure interne de la base.
revoke all on function public.inventaire_schema() from public;
revoke all on function public.inventaire_schema() from anon;
revoke all on function public.inventaire_schema() from authenticated;
grant execute on function public.inventaire_schema() to service_role;
