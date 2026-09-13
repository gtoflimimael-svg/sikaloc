-- ═══════════════════════════════════════════════════════════════════════════
-- Rendre `quittances.bail_id` facultative, avant de la retirer
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Le problème que cette migration existe pour éviter ────────────────────
--
-- La migration suivante (20260913000800) supprime `quittances.bail_id`. Prise
-- seule, elle casse l'émission de quittances pendant le déploiement, quel que
-- soit l'ordre choisi :
--
--   supprimer la colonne PUIS déployer
--       le code encore en ligne insère `bail_id` → « column does not exist »
--
--   déployer PUIS supprimer la colonne
--       le nouveau code n'insère plus `bail_id`, qui est NOT NULL
--       → « null value violates not-null constraint »
--
-- Entre les deux, une fenêtre de quelques minutes où un bailleur qui valide un
-- paiement n'obtient pas sa quittance. C'est court, et c'est précisément le
-- genre de panne qu'on ne reproduit jamais ensuite.
--
-- ─── Élargir, puis rétrécir ────────────────────────────────────────────────
--
-- Retirer la contrainte NOT NULL ouvre un état où les DEUX versions du code
-- fonctionnent : l'ancienne parce qu'elle fournit toujours la valeur, la
-- nouvelle parce que la colonne accepte désormais son silence.
--
--     1. cette migration        les deux versions passent
--     2. le déploiement         plus personne n'écrit la colonne
--     3. migration 000800       la colonne s'en va, sans lecteur ni écrivain
--
-- Aucune donnée n'est touchée ici : les lignes existantes gardent leur valeur.
-- Seule la contrainte tombe.

alter table public.quittances
  alter column bail_id drop not null;

comment on column public.quittances.bail_id is
  'En cours de retrait (voir 20260913000800). Plus aucun code ne l''écrit ni ne la lit : le bail d''une quittance se déduit de son paiement, seule valeur qui reste vraie après une correction.';
