-- ═══════════════════════════════════════════════════════════════════════════
-- Le bailleur doit pouvoir émettre ses invitations
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Ce qui manquait ───────────────────────────────────────────────────────
--
-- La migration précédente n'accordait que `select` à `authenticated`. Le
-- bouton « Inviter » échouait donc sur « permission denied for table
-- invitations_locataire » — le bailleur pouvait lire ses invitations, pas en
-- créer.
--
-- Le banc ne pouvait pas le voir : il insérait avec la clé de service, qui
-- contourne les droits. C'est l'essai dans un vrai navigateur, avec une vraie
-- session de bailleur, qui l'a fait apparaître. Le banc est corrigé pour passer
-- désormais par la session du bailleur.
--
-- ─── Le trou qu'un simple `grant insert` aurait ouvert ─────────────────────
--
-- Une politique qui se contenterait de `auth.uid() = bailleur_id` laisserait
-- un bailleur insérer une invitation portant SON identifiant mais le
-- `locataire_id` du locataire de quelqu'un d'autre. En l'acceptant, un complice
-- se serait rattaché à la ligne d'un inconnu — et aurait vu ses quittances.
--
-- La clause `with check` vérifie donc les deux : c'est bien son identifiant, et
-- c'est bien son locataire.

-- ── Créer ──────────────────────────────────────────────────────────────────
grant insert on public.invitations_locataire to authenticated;

drop policy if exists "Un bailleur invite ses propres locataires" on public.invitations_locataire;
create policy "Un bailleur invite ses propres locataires"
  on public.invitations_locataire
  for insert
  to authenticated
  with check (
    (select auth.uid()) = bailleur_id
    and exists (
      select 1
        from public.locataires l
       where l.id = locataire_id
         and l.bailleur_id = (select auth.uid())
    )
  );

-- ── Annuler ────────────────────────────────────────────────────────────────
--
-- Droit limité à la seule colonne `annulee_le`, au niveau du grant : les
-- politiques RLS ne savent pas restreindre par colonne, les privilèges si.
-- Le bailleur peut donc révoquer une invitation, et rien d'autre — ni
-- déplacer l'empreinte, ni repousser l'expiration, ni marquer une invitation
-- comme utilisée.
grant update (annulee_le) on public.invitations_locataire to authenticated;

drop policy if exists "Un bailleur annule ses invitations" on public.invitations_locataire;
create policy "Un bailleur annule ses invitations"
  on public.invitations_locataire
  for update
  to authenticated
  using ((select auth.uid()) = bailleur_id)
  with check ((select auth.uid()) = bailleur_id);

-- Aucun `delete` : une invitation consommée ou annulée est une trace. La purge
-- des plus anciennes passe par `prive.purger_invitations`, côté serveur.
