-- =============================================================================
-- Sikaloc — Droits de service_role sur le schéma public
--
-- Corrige le problème connu sous « O7 » : après chaque `supabase db reset`,
-- tout code passant par `creerClientAdmin()` échouait en local avec un 403
-- `42501 permission denied`, alors que la production fonctionnait. La panne
-- était silencieuse — les erreurs sont attrapées et rendues au formulaire.
--
-- ─── La cause, mesurée le 12/09/2026 ────────────────────────────────────────
--
-- Les privilèges par défaut posés par `postgres` sur le schéma `public`
-- n'accordent que `Dxtm` aux rôles applicatifs :
--
--   postgres | public | r | {…, service_role=Dxtm/postgres}
--
-- soit TRUNCATE, REFERENCES et TRIGGER — mais ni SELECT, ni INSERT, ni UPDATE,
-- ni DELETE. Les tables de Sikaloc sont créées par les migrations, donc
-- possédées par `postgres`, et héritent de cet ACL plutôt que de celui posé par
-- `supabase_admin` (qui, lui, accorde bien `arwdDxtm`).
--
-- `authenticated` ne s'en apercevait pas : 20260817000300_rls.sql lui accorde
-- explicitement ses droits, table par table. `service_role` n'a jamais rien
-- reçu d'explicite, et vivait en production sur un grant posé à la main, hors
-- de toute migration.
--
-- ─── Pourquoi une migration plutôt qu'un correctif dans seed.sql ────────────
--
-- `seed.sql` ne s'exécute qu'en local et qu'au reset. Un nouveau projet Supabase
-- — bascule de région, environnement de recette, restauration — rencontrerait
-- exactement la même panne, et il n'en resterait aucune trace écrite. Le schéma
-- doit déclarer les droits dont il a besoin ; c'est ce qui rend un `db reset`
-- local identique à la production.
--
-- Cette migration est sans effet en production, où les droits existent déjà :
-- un `grant` est idempotent. Elle y est appliquée malgré tout pour que les deux
-- historiques restent alignés — la dérive des migrations est la panne que tout
-- l'appareillage de surveillance existe pour empêcher.
--
-- ─── Ce que cela ne change pas ──────────────────────────────────────────────
--
-- `service_role` est la clé d'administration : elle contourne les RLS par
-- conception, ne quitte jamais le serveur (`import 'server-only'` dans
-- src/lib/supabase/admin.ts) et n'est jamais exposée au navigateur. Lui rendre
-- les droits que Supabase lui destine n'ouvre aucune surface nouvelle.
--
-- `anon` n'est pas touché et reste révoqué par 20260817000300_rls.sql : aucune
-- donnée de Sikaloc n'est lisible anonymement.
-- =============================================================================

-- ─── Le parc existant ───────────────────────────────────────────────────────

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines  in schema public to service_role;

-- ─── Et tout ce qui sera créé ensuite ───────────────────────────────────────
--
-- Sans ces trois lignes, la prochaine table ajoutée par une migration
-- retomberait dans le même trou et la panne reviendrait, à l'identique.

alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines  to service_role;

-- ─── Rappel explicite : anon ne gagne rien ──────────────────────────────────
--
-- Répété ici plutôt que supposé. Une lecture rapide de cette migration pourrait
-- laisser croire que les droits sont rendus à tout le monde.

revoke all on all tables in schema public from anon;
