-- =============================================================================
-- Sikaloc — Row Level Security
-- Référence : spec §9.2 « RLS strict sur toutes les tables. Un bailleur ne peut
-- lire/écrire que ses propres données. »
--
-- Deux principes appliqués partout :
--   1. `to authenticated` seul est une authentification sans autorisation. Il
--      est systématiquement accompagné d'un prédicat de propriété.
--   2. Toute policy UPDATE porte USING *et* WITH CHECK — sans WITH CHECK, un
--      utilisateur pourrait réaffecter la ligne à un autre bailleur.
--
-- `(select auth.uid())` est enveloppé dans un sous-select : Postgres l'évalue
-- une fois en InitPlan au lieu d'un appel par ligne.
-- =============================================================================

alter table public.bailleurs                enable row level security;
alter table public.locataires               enable row level security;
alter table public.logements                enable row level security;
alter table public.baux                     enable row level security;
alter table public.paiements                enable row level security;
alter table public.quittances               enable row level security;
alter table public.abonnements_transactions enable row level security;
alter table public.recompenses_parrainage   enable row level security;
alter table public.tentatives_connexion     enable row level security;

-- ─── Privilèges de table ────────────────────────────────────────────────────
-- Aucune donnée de Sikaloc n'est lisible anonymement.

revoke all on all tables in schema public from anon;

grant select, update                 on public.bailleurs                to authenticated;
grant select, insert, update, delete on public.locataires               to authenticated;
grant select, insert, update, delete on public.logements                to authenticated;
grant select, insert, update, delete on public.baux                     to authenticated;
grant select, insert, update, delete on public.paiements                to authenticated;
grant select                         on public.quittances               to authenticated;
grant select                         on public.abonnements_transactions to authenticated;
grant select                         on public.recompenses_parrainage   to authenticated;

-- `tentatives_connexion` reste accessible au seul service_role : elle est
-- écrite avant qu'une session n'existe, donc hors de portée d'auth.uid().
-- RLS activée sans aucune policy = table fermée à anon et authenticated.

-- ─── Bailleurs ──────────────────────────────────────────────────────────────

create policy "Un bailleur lit son propre profil"
  on public.bailleurs for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Un bailleur modifie son propre profil"
  on public.bailleurs for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Pas de policy INSERT : le profil naît du trigger `creer_profil_bailleur`.
-- Pas de policy DELETE : la suppression passe par auth.users (cascade).

-- ─── Locataires ─────────────────────────────────────────────────────────────

create policy "Un bailleur lit ses locataires"
  on public.locataires for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

create policy "Un bailleur crée ses locataires"
  on public.locataires for insert
  to authenticated
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur modifie ses locataires"
  on public.locataires for update
  to authenticated
  using ((select auth.uid()) = bailleur_id)
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur supprime ses locataires"
  on public.locataires for delete
  to authenticated
  using ((select auth.uid()) = bailleur_id);

-- ─── Logements ──────────────────────────────────────────────────────────────

create policy "Un bailleur lit ses logements"
  on public.logements for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

create policy "Un bailleur crée ses logements"
  on public.logements for insert
  to authenticated
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur modifie ses logements"
  on public.logements for update
  to authenticated
  using ((select auth.uid()) = bailleur_id)
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur supprime ses logements"
  on public.logements for delete
  to authenticated
  using ((select auth.uid()) = bailleur_id);

-- ─── Baux ───────────────────────────────────────────────────────────────────

create policy "Un bailleur lit ses baux"
  on public.baux for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

create policy "Un bailleur crée ses baux"
  on public.baux for insert
  to authenticated
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur modifie ses baux"
  on public.baux for update
  to authenticated
  using ((select auth.uid()) = bailleur_id)
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur supprime ses baux"
  on public.baux for delete
  to authenticated
  using ((select auth.uid()) = bailleur_id);

-- ─── Paiements ──────────────────────────────────────────────────────────────

create policy "Un bailleur lit ses paiements"
  on public.paiements for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

create policy "Un bailleur enregistre ses paiements"
  on public.paiements for insert
  to authenticated
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur corrige ses paiements"
  on public.paiements for update
  to authenticated
  using ((select auth.uid()) = bailleur_id)
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur supprime ses paiements"
  on public.paiements for delete
  to authenticated
  using ((select auth.uid()) = bailleur_id);

-- ─── Quittances ─────────────────────────────────────────────────────────────
-- Lecture seule côté client : une quittance est un acte, elle n'est produite
-- que par le générateur PDF côté serveur (service_role).

create policy "Un bailleur lit ses quittances"
  on public.quittances for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

-- ─── Abonnement et parrainage ───────────────────────────────────────────────

create policy "Un bailleur lit ses transactions d'abonnement"
  on public.abonnements_transactions for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

create policy "Un parrain lit ses récompenses"
  on public.recompenses_parrainage for select
  to authenticated
  using ((select auth.uid()) = parrain_id);
