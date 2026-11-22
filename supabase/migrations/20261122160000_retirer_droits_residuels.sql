-- Droits résiduels des rôles d'API (SEC-07).
--
-- 1. Objets existants : anon et authenticated gardaient TRIGGER, REFERENCES,
--    TRUNCATE et MAINTAIN sur des tables et vues de `public`, ainsi que des
--    droits sur la séquence d'identité de `tentatives_connexion`. Aucun parcours
--    ne s'en sert : SELECT/INSERT/UPDATE/DELETE restent régis par les droits
--    explicites et la RLS déjà en place.
--
-- 2. Droits par défaut : en production, une table créée par `postgres` dans
--    `public` était encore ouverte en totalité à anon/authenticated (arwdDxtm),
--    une fonction exécutable par eux, une séquence modifiable. La base locale ne
--    l'est pas : une révocation antérieure n'avait visé que le rôle exécutant.
--    `for role postgres` rend la règle explicite partout. Chaque migration
--    accorde déjà ses droits nommément (grant ... to authenticated).

revoke references, trigger, truncate, maintain
  on all tables in schema public from anon, authenticated;

revoke all on sequence public.tentatives_connexion_id_seq from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
