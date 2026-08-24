-- =============================================================================
-- Sikaloc — inscriptions au guide destiné aux prospects
-- =============================================================================
--
-- Adresses recueillies sur la page d'accueil, en échange du guide « Ce que
-- contient une quittance Sikaloc ». Ce sont des PROSPECTS, pas des bailleurs :
-- ils n'ont pas de compte, et cette table n'a aucun lien avec `bailleurs`.
--
-- Consentement en deux temps. Une adresse saisie ne vaut rien tant que son
-- propriétaire n'a pas cliqué le lien reçu par email : sans cela, n'importe qui
-- pourrait inscrire l'adresse d'un tiers, et le guide partirait vers quelqu'un
-- qui ne l'a jamais demandé.

create table if not exists public.inscriptions_guide (
  id uuid primary key default gen_random_uuid(),

  email text not null,

  -- `en_attente` : adresse saisie, confirmation non cliquée. Le guide n'est pas
  -- parti et ne partira pas.
  -- `confirme`   : consentement recueilli, guide envoyé.
  -- `desinscrit` : retrait demandé. La ligne est conservée pour ne pas
  --                réinscrire quelqu'un qui s'est retiré, et pour pouvoir
  --                prouver la date du retrait.
  statut text not null default 'en_attente'
    check (statut in ('en_attente', 'confirme', 'desinscrit')),

  -- Sert à la fois à confirmer et à se désinscrire. Renouvelé à chaque nouvelle
  -- demande d'inscription, ce qui invalide les liens précédents.
  jeton text not null unique,

  -- Trace de la provenance, si d'autres points de collecte apparaissent.
  origine text not null default 'accueil',

  cree_le timestamptz not null default now(),
  confirme_le timestamptz,
  desinscrit_le timestamptz,

  -- Horodatage du dernier envoi de confirmation, pour ne pas transformer le
  -- formulaire en outil d'envoi de courrier non sollicité.
  dernier_envoi_le timestamptz
);

-- Une adresse, une ligne. La comparaison est insensible à la casse : les
-- adresses sont déjà normalisées en minuscules à la saisie, mais une donnée
-- entrée autrement ne doit pas créer de doublon.
create unique index if not exists inscriptions_guide_email_unique
  on public.inscriptions_guide (lower(email));

create index if not exists inscriptions_guide_statut_idx
  on public.inscriptions_guide (statut);

comment on table public.inscriptions_guide is
  'Prospects inscrits au guide, avec consentement confirmé par email. Sans lien avec les comptes bailleurs.';

-- ─── Accès ───────────────────────────────────────────────────────────────────
--
-- RLS activé et AUCUNE policy : ni `anon` ni `authenticated` ne peuvent lire ou
-- écrire quoi que ce soit. Seul `service_role`, qui contourne RLS, y accède —
-- depuis les Server Actions et les routes serveur.
--
-- C'est délibéré : une liste d'adresses email est exactement le genre de table
-- qu'on ne veut jamais voir exposée par l'API publique, fût-ce en lecture.

alter table public.inscriptions_guide enable row level security;
