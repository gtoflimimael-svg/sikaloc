-- =============================================================================
-- Sikaloc — l'inventaire doit voir les déclencheurs du schéma `auth`
-- =============================================================================
--
-- La version précédente de `inventaire_schema()` ne regardait que `public` et
-- `prive`. Elle déclarait donc absent `creer_profil_bailleur`, qui est posé sur
-- `auth.users` — le déclencheur qui crée le profil bailleur à l'inscription.
--
-- Une fausse alerte sur un objet critique est pire qu'une absence d'alerte :
-- elle apprend à ignorer le message. Corrigé en ajoutant `auth` au seul volet
-- concerné, les déclencheurs. Les contraintes, index et politiques de `auth`
-- appartiennent à Supabase, ne figurent dans aucune de nos migrations, et n'ont
-- rien à faire dans cet inventaire.
--
-- Migration séparée plutôt que retouche de `20260824000100` : celle-ci est déjà
-- appliquée en production. La modifier sur le disque recréerait exactement
-- l'écart entre fichiers et base que ce contrôle a pour métier de détecter.

create or replace function public.inventaire_schema()
returns table (categorie text, schema text, nom text)
language sql
stable
security definer
set search_path = ''
as $$
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

  -- `auth` ajouté ici, et nulle part ailleurs : nos migrations y posent un
  -- déclencheur, rien d'autre.
  select 'declencheur', n.nspname::text, t.tgname::text
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class cl on cl.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = cl.relnamespace
   where n.nspname in ('public', 'prive', 'auth')
     and not t.tgisinternal
$$;

revoke all on function public.inventaire_schema() from public;
revoke all on function public.inventaire_schema() from anon;
revoke all on function public.inventaire_schema() from authenticated;
grant execute on function public.inventaire_schema() to service_role;
