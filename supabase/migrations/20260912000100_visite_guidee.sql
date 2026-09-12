-- =============================================================================
-- Sikaloc — Visite guidée interactive
--
-- Deux ajouts, et le moins possible.
--
-- 1. `visite_quittee_le` : la seule information que le produit ne sait pas déjà
--    déduire. « Terminée » est déjà portée par `tutoriel_vu_le` ; « en cours »
--    et « non commencée » se lisent dans les données du bailleur. Mais une
--    visite QUITTÉE est indiscernable d'une visite jamais commencée, et la
--    règle voulue est de ne plus l'imposer à chaque connexion tout en laissant
--    la reprendre. D'où cette colonne, symétrique de `tutoriel_vu_le`.
--
--    Une date plutôt qu'un booléen, pour la même raison qu'en 20260825000100 :
--    elle dit aussi QUAND, ce qui servira le jour où l'on voudra reproposer la
--    visite après une refonte de l'interface.
--
-- 2. `v_progression_visite` : l'avancement, dérivé des données réelles.
--
--    Aucune colonne « étape_logement_faite ». Un second état à tenir cohérent
--    avec la base mentirait à la première suppression d'entité, et imposerait
--    une écriture serveur à chaque clic. Ici, il n'y a rien à synchroniser :
--    le bailleur qui possède un logement A créé un logement, point. La
--    progression survit donc au rafraîchissement, à la fermeture du navigateur
--    et au changement d'appareil sans qu'on ait rien à persister.
--
--    Le revers est assumé : supprimer son unique logement décoche l'étape.
--    Rendre cela irréversible demanderait une table d'événements, c'est-à-dire
--    beaucoup de machinerie pour un cas qui n'arrive qu'en explorant.
-- =============================================================================

alter table public.bailleurs
  add column if not exists visite_quittee_le timestamptz;

comment on column public.bailleurs.visite_quittee_le is
  'Date à laquelle le bailleur a quitté la visite guidée sans la terminer. '
  'NULL et tutoriel_vu_le NULL = jamais commencée. Renseignée = ne plus ouvrir '
  'd''elle-même, mais rester reprenable.';

-- ─── Avancement du parcours ─────────────────────────────────────────────────
--
-- `security_invoker = true` est indispensable : sans lui, la vue s'exécuterait
-- avec les droits de son créateur et court-circuiterait les policies RLS.
--
-- Trois précautions que des compteurs naïfs rateraient :
--
--   • les paiements sont filtrés sur `Validé`. Une ligne de paiement existe dès
--     le brouillon, avant l'écran de confirmation : compter sans filtrer
--     cocherait l'étape pour un formulaire abandonné.
--
--   • les quittances sont filtrées sur `pdf_chemin is not null`. `validerPaiement`
--     lance la validation et la génération en parallèle et conserve le paiement
--     même si le document échoue : la ligne peut exister sans document.
--
--   • les baux sont comptés TOUS STATUTS. Se fonder sur les baux actifs ferait
--     reculer la progression à la première résiliation.

create or replace view public.v_progression_visite with (security_invoker = true) as
select
  b.id as bailleur_id,

  (select count(*) from public.logements l
    where l.bailleur_id = b.id) as nb_logements,

  (select count(*) from public.locataires t
    where t.bailleur_id = b.id) as nb_locataires,

  (select count(*) from public.baux x
    where x.bailleur_id = b.id) as nb_baux,

  (select count(*) from public.paiements p
    where p.bailleur_id = b.id
      and p.statut = 'Validé') as nb_paiements,

  (select count(*) from public.quittances q
    where q.bailleur_id = b.id
      and q.pdf_chemin is not null) as nb_quittances

from public.bailleurs b;

comment on view public.v_progression_visite is
  'Avancement du bailleur dans la visite guidée, dérivé de ses données réelles. '
  'Une ligne par bailleur, cinq compteurs.';

revoke all on public.v_progression_visite from anon;
grant select on public.v_progression_visite to authenticated;
