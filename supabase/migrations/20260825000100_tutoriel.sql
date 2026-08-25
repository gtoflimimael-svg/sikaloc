-- =============================================================================
-- Sikaloc — didacticiel d'accueil du tableau de bord
-- =============================================================================
--
-- L'onboarding n'exige plus de créer un locataire, un logement et un bail avant
-- d'accéder au tableau de bord. Le bailleur y arrive donc sur un écran vide, et
-- c'est le didacticiel qui prend le relais pour lui montrer où agir.
--
-- Une date plutôt qu'un booléen : elle dit AUSSI quand le tutoriel a été vu, ce
-- qu'un `true` ne dit pas. Utile le jour où l'on voudra le rejouer après une
-- refonte de l'interface.
--
-- `null` = jamais vu. Le didacticiel s'ouvre alors de lui-même à la première
-- arrivée sur le tableau de bord.

alter table public.bailleurs
  add column if not exists tutoriel_vu_le timestamptz;

comment on column public.bailleurs.tutoriel_vu_le is
  'Date de première fermeture du didacticiel d''accueil. NULL = jamais vu, il s''ouvre automatiquement.';
