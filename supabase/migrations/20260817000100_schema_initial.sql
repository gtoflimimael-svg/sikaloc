-- =============================================================================
-- Sikaloc — Schéma initial
-- Référence : Sika_MVP_Specification_Finale.md §8 (structure de données)
--
-- Note sur l'authentification : la spécification §6.1.1 demande un hachage
-- bcrypt du mot de passe. Il est géré par Supabase Auth (`auth.users`, bcrypt)
-- plutôt que dupliqué ici — dupliquer un hash de mot de passe dans une table
-- applicative exposée au Data API serait une régression de sécurité.
-- La table `bailleurs` porte donc le profil métier, pas les identifiants.
-- =============================================================================

-- Schéma privé : héberge les fonctions SECURITY DEFINER pour qu'elles ne soient
-- pas exposées comme endpoints publics via PostgREST.
create schema if not exists prive;
revoke all on schema prive from anon, authenticated;

-- ─── Types énumérés ─────────────────────────────────────────────────────────

create type public.type_logement as enum (
  'Appartement', 'Maison', 'Studio', 'Boutique', 'Autre'
);

create type public.statut_bail as enum ('Actif', 'Résilié');

create type public.mode_paiement as enum (
  'Espèces', 'Mobile Money', 'Virement bancaire', 'Autre'
);

create type public.type_paiement as enum (
  'Loyer', 'Charges', 'Dépôt de garantie'
);

create type public.statut_paiement as enum ('Brouillon', 'Validé');

create type public.plan_abonnement as enum ('Gratuit', 'Standard');

create type public.type_document as enum ('Quittance', 'Reçu');

-- ─── Bailleurs (profil applicatif adossé à auth.users) ──────────────────────

create table public.bailleurs (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nom                   text not null check (length(trim(nom)) between 2 and 120),
  telephone             text not null check (length(trim(telephone)) between 8 and 20),
  email                 text not null,
  adresse               text,
  -- Chemin de l'objet dans le bucket privé `signatures`, jamais une URL publique.
  signature_chemin      text,
  plan                  public.plan_abonnement not null default 'Gratuit',
  date_fin_abonnement   date,
  parrain_id            uuid references public.bailleurs (id) on delete set null,
  code_parrainage       text not null unique,
  nb_logements_declare  smallint check (nb_logements_declare between 0 and 1000),
  onboarding_termine    boolean not null default false,
  notif_email           boolean not null default true,
  notif_whatsapp        boolean not null default true,
  created_at            timestamptz not null default now(),
  -- Un bailleur ne peut pas se parrainer lui-même.
  constraint bailleurs_parrain_different check (parrain_id is null or parrain_id <> id)
);

create index bailleurs_parrain_id_idx on public.bailleurs (parrain_id);

comment on table public.bailleurs is
  'Profil métier du bailleur. Les identifiants (email + hash bcrypt) vivent dans auth.users.';

-- ─── Locataires ─────────────────────────────────────────────────────────────

create table public.locataires (
  id                    uuid primary key default gen_random_uuid(),
  bailleur_id           uuid not null references public.bailleurs (id) on delete cascade,
  nom                   text not null check (length(trim(nom)) between 2 and 120),
  telephone             text not null check (length(trim(telephone)) between 8 and 20),
  email                 text,
  consentement_donnees  boolean not null default false,
  date_consentement     date,
  created_at            timestamptz not null default now(),
  -- Règle métier §6.1.5 : le consentement est obligatoire à la création, et sa
  -- date est indissociable de son attestation.
  constraint locataires_consentement_obligatoire check (consentement_donnees is true),
  constraint locataires_date_consentement_coherente
    check (date_consentement is not null)
);

create index locataires_bailleur_id_idx on public.locataires (bailleur_id);

comment on constraint locataires_consentement_obligatoire on public.locataires is
  'Le bailleur atteste avoir informé le locataire de la collecte de ses données (spec §6.1.5).';

-- ─── Logements ──────────────────────────────────────────────────────────────

create table public.logements (
  id           uuid primary key default gen_random_uuid(),
  bailleur_id  uuid not null references public.bailleurs (id) on delete cascade,
  adresse      text not null check (length(trim(adresse)) between 3 and 300),
  type         public.type_logement not null,
  ville        text not null check (length(trim(ville)) between 2 and 120),
  pays         text not null default 'Bénin',
  created_at   timestamptz not null default now()
);

create index logements_bailleur_id_idx on public.logements (bailleur_id);

-- ─── Baux (entité centrale) ─────────────────────────────────────────────────

create table public.baux (
  id               uuid primary key default gen_random_uuid(),
  bailleur_id      uuid not null references public.bailleurs (id) on delete cascade,
  logement_id      uuid not null references public.logements (id) on delete restrict,
  locataire_id     uuid not null references public.locataires (id) on delete restrict,
  loyer_mensuel    numeric(12, 2) not null check (loyer_mensuel > 0),
  date_debut       date not null,
  date_fin         date,
  jour_echeance    smallint not null check (jour_echeance between 1 and 31),
  tolerance_jours  smallint not null default 5 check (tolerance_jours between 0 and 60),
  depot_garantie   numeric(12, 2) check (depot_garantie >= 0),
  statut           public.statut_bail not null default 'Actif',
  created_at       timestamptz not null default now(),
  constraint baux_dates_coherentes check (date_fin is null or date_fin >= date_debut)
);

create index baux_bailleur_id_idx on public.baux (bailleur_id);
create index baux_locataire_id_idx on public.baux (locataire_id);
create index baux_logement_id_idx on public.baux (logement_id);

-- Règle métier §6.1.6 : un logement ne peut porter qu'un seul bail actif.
-- Un index unique partiel l'impose au niveau base, sans race condition possible.
create unique index baux_un_seul_actif_par_logement
  on public.baux (logement_id)
  where statut = 'Actif';

-- ─── Paiements ──────────────────────────────────────────────────────────────

create table public.paiements (
  id              uuid primary key default gen_random_uuid(),
  bailleur_id     uuid not null references public.bailleurs (id) on delete cascade,
  bail_id         uuid not null references public.baux (id) on delete restrict,
  date_paiement   date not null,
  montant         numeric(12, 2) not null check (montant > 0),
  periode_debut   date not null,
  periode_fin     date not null,
  mode_paiement   public.mode_paiement not null,
  type_paiement   public.type_paiement not null default 'Loyer',
  est_partiel     boolean not null default false,
  statut          public.statut_paiement not null default 'Brouillon',
  -- Horodatage de la validation : sert de départ à la fenêtre de correction
  -- de 5 minutes décrite au §6.1.7.
  valide_le       timestamptz,
  created_at      timestamptz not null default now(),
  constraint paiements_periode_coherente check (periode_fin >= periode_debut),
  -- `extract` est IMMUTABLE, contrairement à date_trunc('month', <date>) qui
  -- résout vers la surcharge timestamptz (STABLE) et serait rejeté ici.
  constraint paiements_periode_debut_est_1er_du_mois
    check (extract(day from periode_debut) = 1),
  constraint paiements_valide_le_coherent
    check ((statut = 'Validé') = (valide_le is not null))
);

create index paiements_bailleur_id_idx on public.paiements (bailleur_id);
create index paiements_bail_periode_idx on public.paiements (bail_id, periode_debut);
create index paiements_date_paiement_idx on public.paiements (bailleur_id, date_paiement desc);

comment on column public.paiements.est_partiel is
  'Si true, le document généré est un « Reçu » et non une « Quittance » (spec §6.1.7).';

-- ─── Quittances / Reçus ─────────────────────────────────────────────────────

create table public.quittances (
  id               uuid primary key default gen_random_uuid(),
  bailleur_id      uuid not null references public.bailleurs (id) on delete cascade,
  paiement_id      uuid not null unique references public.paiements (id) on delete cascade,
  bail_id          uuid not null references public.baux (id) on delete restrict,
  numero_document  text not null unique,
  type             public.type_document not null,
  pays             text not null default 'Bénin',
  date_generation  timestamptz not null default now(),
  -- Chemin de l'objet dans le bucket privé `quittances`. L'URL signée (30 j)
  -- est produite à la demande — la stocker reviendrait à figer son expiration.
  pdf_chemin       text,
  created_at       timestamptz not null default now()
);

create index quittances_bailleur_id_idx on public.quittances (bailleur_id);
create index quittances_bail_id_idx on public.quittances (bail_id);

-- ─── Abonnement : transactions CinetPay ─────────────────────────────────────

create table public.abonnements_transactions (
  id                uuid primary key default gen_random_uuid(),
  bailleur_id       uuid not null references public.bailleurs (id) on delete cascade,
  transaction_id    text not null unique,
  montant           numeric(12, 2) not null check (montant >= 0),
  devise            text not null default 'XOF',
  statut            text not null default 'EN_ATTENTE',
  operateur         text,
  payload_notif     jsonb,
  created_at        timestamptz not null default now(),
  mis_a_jour_le     timestamptz not null default now()
);

create index abonnements_transactions_bailleur_idx
  on public.abonnements_transactions (bailleur_id, created_at desc);

-- ─── Parrainage ─────────────────────────────────────────────────────────────

create table public.recompenses_parrainage (
  id            uuid primary key default gen_random_uuid(),
  parrain_id    uuid not null references public.bailleurs (id) on delete cascade,
  filleul_id    uuid not null references public.bailleurs (id) on delete cascade,
  mois_offerts  smallint not null default 1 check (mois_offerts > 0),
  attribuee_le  timestamptz not null default now(),
  -- Une souscription de filleul ne récompense qu'une fois.
  constraint recompenses_parrainage_unique unique (parrain_id, filleul_id)
);

create index recompenses_parrainage_parrain_idx
  on public.recompenses_parrainage (parrain_id);

-- ─── Limitation des tentatives de connexion (§6.1.1 : 5 essais / 15 min) ────
-- Écrite et lue uniquement côté serveur avec la clé service_role.

create table public.tentatives_connexion (
  id          bigint generated always as identity primary key,
  email       text not null,
  reussie     boolean not null default false,
  ip          text,
  tentee_le   timestamptz not null default now()
);

create index tentatives_connexion_email_idx
  on public.tentatives_connexion (lower(email), tentee_le desc);
