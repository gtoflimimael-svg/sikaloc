-- =============================================================================
-- Sikaloc — Jeu de démonstration (développement local uniquement)
--
-- Appliqué automatiquement par `supabase start` et `supabase db reset`.
-- NE JAMAIS exécuter sur une base de production : il crée un compte dont le
-- mot de passe est public.
--
--   Connexion :  demo@sikaloc.com  /  demo1234
--
-- Le jeu couvre les trois situations que le tableau de bord doit savoir montrer :
-- un loyer payé, un loyer partiellement payé, et un loyer en retard.
-- =============================================================================

-- Identifiants fixes : le seed doit être rejouable à l'identique.
\set bailleur_id      '\'11111111-1111-4111-8111-111111111111\''
\set locataire_awa    '\'22222222-2222-4222-8222-222222222221\''
\set locataire_pascal '\'22222222-2222-4222-8222-222222222222\''
\set locataire_fatou  '\'22222222-2222-4222-8222-222222222223\''
\set logement_1       '\'33333333-3333-4333-8333-333333333331\''
\set logement_2       '\'33333333-3333-4333-8333-333333333332\''
\set logement_3       '\'33333333-3333-4333-8333-333333333333\''
\set bail_1           '\'44444444-4444-4444-8444-444444444441\''
\set bail_2           '\'44444444-4444-4444-8444-444444444442\''
\set bail_3           '\'44444444-4444-4444-8444-444444444443\''

-- ─── Compte bailleur ────────────────────────────────────────────────────────
-- L'insertion dans auth.users déclenche `creer_profil_bailleur`, qui crée la
-- ligne correspondante dans public.bailleurs.

-- Les colonnes de jetons doivent valoir '' et non NULL : GoTrue les scanne
-- dans des `string` Go non-nullables et échoue sinon à la connexion avec
-- « Database error querying schema », sans indiquer la cause.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change,
  email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  :bailleur_id,
  'authenticated',
  'authenticated',
  'demo@sikaloc.com',
  crypt('demo1234', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nom":"Koffi Adjovi","telephone":"+229 97 12 34 56","nb_logements":"3"}'::jsonb,
  now() - interval '3 months',
  now(),
  '', '', '', '', '', '', '', ''
)
on conflict (id) do nothing;

-- Sans identity associée, GoTrue refuse la connexion par mot de passe.
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
)
values (
  :bailleur_id,
  :bailleur_id,
  format('{"sub":"%s","email":"demo@sikaloc.com","email_verified":true}', :bailleur_id)::jsonb,
  'email',
  now(),
  now() - interval '3 months',
  now()
)
on conflict (provider, provider_id) do nothing;

-- Plan Standard pour la démonstration : c'est lui qui débloque les quittances
-- conformes (mention du droit de timbre) et les relances WhatsApp. Repasser
-- `plan` à 'Gratuit' permet de vérifier les limites du plan gratuit.
update public.bailleurs
   set adresse             = 'Lot 118, Quartier Haie Vive, Cotonou',
       onboarding_termine  = true,
       plan                = 'Standard',
       date_fin_abonnement = (current_date + interval '1 month')::date
 where id = :bailleur_id;

-- ─── Locataires ─────────────────────────────────────────────────────────────

insert into public.locataires (
  id, bailleur_id, nom, telephone, email, consentement_donnees, date_consentement
)
values
  (:locataire_awa, :bailleur_id, 'Awa Kponou', '+229 96 55 44 33',
   'awa.kponou@exemple.bj', true, current_date - 90),
  (:locataire_pascal, :bailleur_id, 'Pascal Dossou', '+229 95 11 22 33',
   null, true, current_date - 60),
  (:locataire_fatou, :bailleur_id, 'Fatou Bio', '+229 94 88 77 66',
   'fatou.bio@exemple.bj', true, current_date - 45)
on conflict (id) do nothing;

-- ─── Logements ──────────────────────────────────────────────────────────────

insert into public.logements (id, bailleur_id, adresse, type, ville, pays)
values
  (:logement_1, :bailleur_id, 'Lot 42, Quartier Fidjrossè', 'Appartement', 'Cotonou', 'Bénin'),
  (:logement_2, :bailleur_id, 'Rue 12.45, Quartier Cadjèhoun', 'Studio', 'Cotonou', 'Bénin'),
  (:logement_3, :bailleur_id, 'Carré 208, Quartier Vodjè', 'Maison', 'Cotonou', 'Bénin')
on conflict (id) do nothing;

-- ─── Baux ───────────────────────────────────────────────────────────────────

insert into public.baux (
  id, bailleur_id, logement_id, locataire_id, loyer_mensuel,
  date_debut, jour_echeance, tolerance_jours, depot_garantie, statut
)
values
  (:bail_1, :bailleur_id, :logement_1, :locataire_awa, 60000,
   current_date - interval '5 months', 5, 5, 120000, 'Actif'),
  (:bail_2, :bailleur_id, :logement_2, :locataire_pascal, 35000,
   current_date - interval '4 months', 10, 5, 70000, 'Actif'),
  (:bail_3, :bailleur_id, :logement_3, :locataire_fatou, 120000,
   current_date - interval '3 months', 1, 3, 240000, 'Actif')
on conflict (id) do nothing;

-- ─── Paiements ──────────────────────────────────────────────────────────────
-- Awa règle rubis sur l'ongle : tous ses loyers sont soldés.
-- Pascal n'a rien versé depuis deux mois → il alimentera la liste des impayés.
-- Fatou a fait un versement partiel le mois dernier → son document est un reçu,
-- et le solde restant apparaît en impayé.

insert into public.paiements (
  bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin,
  mode_paiement, type_paiement, est_partiel, statut, valide_le
)
select
  :bailleur_id,
  :bail_1,
  (date_trunc('month', current_date::timestamp) - (n || ' months')::interval)::date + 4,
  60000,
  (date_trunc('month', current_date::timestamp) - (n || ' months')::interval)::date,
  (date_trunc('month', current_date::timestamp) - ((n - 1) || ' months')::interval)::date - 1,
  'Mobile Money',
  'Loyer',
  false,
  'Validé',
  -- Antidaté : la fenêtre de correction de 5 minutes est déjà close.
  now() - interval '30 days'
from generate_series(1, 4) as n
on conflict do nothing;

insert into public.paiements (
  bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin,
  mode_paiement, type_paiement, est_partiel, statut, valide_le
)
select
  :bailleur_id,
  :bail_2,
  (date_trunc('month', current_date::timestamp) - (n || ' months')::interval)::date + 9,
  35000,
  (date_trunc('month', current_date::timestamp) - (n || ' months')::interval)::date,
  (date_trunc('month', current_date::timestamp) - ((n - 1) || ' months')::interval)::date - 1,
  'Espèces',
  'Loyer',
  false,
  'Validé',
  now() - interval '30 days'
from generate_series(3, 4) as n
on conflict do nothing;

-- Versement partiel de Fatou sur le mois précédent : 70 000 sur 120 000.
insert into public.paiements (
  bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin,
  mode_paiement, type_paiement, est_partiel, statut, valide_le
)
values (
  :bailleur_id,
  :bail_3,
  (date_trunc('month', current_date::timestamp) - interval '1 month')::date + 2,
  70000,
  (date_trunc('month', current_date::timestamp) - interval '1 month')::date,
  date_trunc('month', current_date::timestamp)::date - 1,
  'Virement bancaire',
  'Loyer',
  true,
  'Validé',
  now() - interval '20 days'
)
on conflict do nothing;

-- Loyer du mois courant réglé par Awa. Sans lui, le tableau de bord
-- afficherait 0 FCFA de chiffre d'affaires et 0 % de recouvrement : la
-- démonstration ne montrerait que des cas dégradés.
insert into public.paiements (
  bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin,
  mode_paiement, type_paiement, est_partiel, statut, valide_le
)
values (
  :bailleur_id,
  :bail_1,
  date_trunc('month', current_date::timestamp)::date + 4,
  60000,
  date_trunc('month', current_date::timestamp)::date,
  (date_trunc('month', current_date::timestamp) + interval '1 month')::date - 1,
  'Mobile Money',
  'Loyer',
  false,
  'Validé',
  now() - interval '10 days'
)
on conflict do nothing;
