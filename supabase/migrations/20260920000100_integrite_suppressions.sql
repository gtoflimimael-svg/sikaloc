-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc — S8-E : cohérence de la fermeture d'un compte
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Ce que cette migration ne change PAS ──────────────────────────────────
--
-- La fin de vie normale d'un compte impayé reste l'ANONYMISATION
-- (`prive.purger_donnees_personnelles`, J+90) : les locataires deviennent
-- « Locataire anonymisé », les PDF sont effacés, mais les quittances, les
-- signatures et les baux — l'historique comptable — demeurent. C'est la bonne
-- réponse au droit à l'effacement pour un système qui porte des obligations
-- comptables, et rien ici ne la touche.
--
-- Les protections d'immuabilité restent, elles aussi, entières : on ne peut
-- toujours pas supprimer un paiement figé ni une signature apposée d'un compte
-- VIVANT. C'est vérifié par le banc.
--
-- ─── Le problème réel ──────────────────────────────────────────────────────
--
-- La suppression COMPLÈTE d'un compte — `delete from auth.users`, seule voie
-- d'un vrai droit à l'effacement, et ce dont chaque banc a besoin pour ranger
-- ses comptes de test — échouait. Le rapport S8-D pointait trois FK ; le
-- diagnostic les a en partie corrigées :
--
--   • baux.historique_declare_par     → ne bloquait PAS (le bail part avec son
--   • invitations_locataire.cree_par     bailleur ; ces colonnes visent le même
--                                         bailleur, donc rien ne survit à vérifier)
--
-- Les vrais blocages étaient ailleurs, et tenaient à l'ordre des cascades :
--
--   1. `prive.proteger_suppression_paiement_fige` — le trigger d'immuabilité
--      des paiements refusait la cascade d'un paiement figé, même quand c'est
--      le compte entier qui s'en va.
--   2. `signatures_apposees.bailleur_id` en RESTRICT — bloquait la suppression
--      du bailleur avant même que la cascade des quittances n'ait retiré la
--      signature.
--
-- ─── Le principe du correctif ──────────────────────────────────────────────
--
-- Un trigger d'immuabilité protège un enregistrement d'un compte VIVANT contre
-- l'altération. Il n'a pas à défendre une pièce comptable contre la
-- disparition de son propre propriétaire : ce n'est pas une falsification,
-- c'est une fermeture de compte. Les deux triggers cèdent donc quand le
-- bailleur n'existe plus — exactement le raisonnement déjà tenu par le trigger
-- des signatures pour une quittance disparue, et par les triggers d'annonces
-- via `pg_trigger_depth()`.

-- ─── 1. Paiement figé : céder à la fermeture du compte ─────────────────────
--
-- `paiements.bailleur_id → bailleurs` est en CASCADE, et `paiements.bail_id →
-- baux` en RESTRICT : un paiement n'est donc JAMAIS cascade-supprimé par un
-- bail. La seule cascade qui l'atteint est la suppression de son bailleur. Le
-- test « le bailleur n'existe plus » désigne donc précisément la fermeture du
-- compte, et rien d'autre — plus sûr qu'un `pg_trigger_depth()` qui autoriserait
-- n'importe quelle cascade future.

create or replace function prive.proteger_suppression_paiement_fige()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Fermeture du compte : le bailleur a déjà disparu (sa suppression cascade
  -- jusqu'ici). Ses pièces comptables partent avec lui.
  if not exists (select 1 from public.bailleurs b where b.id = old.bailleur_id) then
    return old;
  end if;

  if old.statut = 'Validé'
     and old.valide_le is not null
     and old.valide_le < now() - interval '5 minutes'
  then
    raise exception 'Ce paiement est figé : il ne peut plus être supprimé.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

-- ─── 2. Signature apposée : céder à la fermeture du compte ─────────────────
--
-- La règle existante reste au complet — quittance disparue, ou fenêtre de
-- correction de 5 minutes. On ajoute seulement, en tête, le cas de la
-- fermeture du compte. Le FK passe en CASCADE (voir §3) : la signature est
-- alors retirée directement par la suppression du bailleur, qui n'existe déjà
-- plus quand ce trigger s'exécute.

create or replace function prive.refuser_suppression_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_corrigeable boolean;
begin
  -- Fermeture du compte : le bailleur a disparu, la signature s'en va avec son
  -- document. Ce n'est pas l'effacement d'une preuve d'un compte vivant.
  if not exists (select 1 from public.bailleurs b where b.id = old.bailleur_id) then
    return old;
  end if;

  -- Cascade depuis `quittances` : le document disparaît, l'événement avec lui.
  if not exists (select 1 from public.quittances q where q.id = old.quittance_id) then
    return old;
  end if;

  -- La fenêtre de correction de 5 minutes autorise à reprendre un paiement
  -- validé, ce qui refabrique son document — la même règle que
  -- `proteger_paiement_fige`, sur le même horodatage.
  select p.statut = 'Validé' and p.valide_le > now() - interval '5 minutes'
    into v_corrigeable
    from public.quittances q
    join public.paiements p on p.id = q.paiement_id
   where q.id = old.quittance_id;

  if coalesce(v_corrigeable, false) then
    return old;
  end if;

  raise exception
    'Une signature apposée ne se supprime pas : le paiement de la quittance % est figé.',
    old.quittance_id
    using errcode = 'check_violation';
end;
$$;

-- ─── 3. signatures_apposees.bailleur_id : RESTRICT → CASCADE ───────────────
--
-- RESTRICT bloquait la suppression du bailleur AVANT que la cascade des
-- quittances n'ait le temps de retirer la signature. NO ACTION ne suffisait
-- pas non plus : l'ordre des cascades faisait courir la vérification directe
-- `bailleurs → signatures` avant celle des quittances.
--
-- CASCADE règle l'ordre : la signature est retirée directement par la
-- suppression du bailleur. L'immuabilité ne repose plus sur ce FK — elle vit
-- désormais tout entière dans le trigger, qui refuse toujours la suppression
-- d'une signature d'un compte vivant. Ce n'est pas « CASCADE pour faire taire
-- l'erreur » : c'est déplacer la garde à l'endroit qui sait distinguer une
-- altération d'une fermeture de compte.

alter table public.signatures_apposees
  drop constraint signatures_apposees_bailleur_id_fkey;

alter table public.signatures_apposees
  add constraint signatures_apposees_bailleur_id_fkey
  foreign key (bailleur_id) references public.bailleurs (id) on delete cascade;

-- ─── 4. Deux traces d'audit : NO ACTION → SET NULL ─────────────────────────
--
-- `baux.historique_declare_par` et `invitations_locataire.cree_par` sont des
-- traces : « qui a déclaré cet historique », « qui a créé cette invitation ».
-- Aujourd'hui elles ne bloquent pas — elles visent le bailleur dont le bail ou
-- l'invitation cascade de toute façon. Mais leur politique n'était qu'implicite,
-- suspendue à cet alignement.
--
-- SET NULL la rend explicite, et juste : si ce bailleur venait à disparaître
-- sans emporter la ligne, le pointeur devient nul plutôt que de bloquer — la
-- même règle que `locataires.compte_id`, pour la même raison. La ligne
-- historique survit, elle ; seul le doigt qui désignait un compte effacé
-- s'efface.

alter table public.baux
  drop constraint baux_historique_declare_par_fkey;

alter table public.baux
  add constraint baux_historique_declare_par_fkey
  foreign key (historique_declare_par) references public.bailleurs (id) on delete set null;

alter table public.invitations_locataire
  drop constraint invitations_locataire_cree_par_fkey;

alter table public.invitations_locataire
  add constraint invitations_locataire_cree_par_fkey
  foreign key (cree_par) references public.bailleurs (id) on delete set null;

-- ─── 5. Détacher une fiche locataire dont le compte disparaît ──────────────
--
-- `locataires.compte_id → auth.users` est en SET NULL : quand un locataire
-- supprime son compte, sa FICHE survit, dissociée. Mais la contrainte
-- `locataires_compte_coherent` exige que `compte_id` et `compte_lie_le` soient
-- tous deux renseignés, ou tous deux nuls. Le SET NULL ne vidait que le
-- premier — et faisait échouer la suppression du compte, silencieusement, pour
-- TOUT locataire ayant un jour lié le sien.
--
-- Ce déclencheur remet les deux d'accord : quand le compte s'en va, la date de
-- liaison s'en va aussi. Une fiche jamais liée et une fiche dont le compte a
-- disparu se ressemblent alors — et c'est juste : dans les deux cas, il n'y a
-- plus de compte derrière.

create or replace function prive.detacher_compte_locataire()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.compte_id is null and old.compte_id is not null then
    new.compte_lie_le := null;
  end if;
  return new;
end;
$$;

create trigger detacher_compte_locataire
  before update of compte_id on public.locataires
  for each row
  execute function prive.detacher_compte_locataire();
