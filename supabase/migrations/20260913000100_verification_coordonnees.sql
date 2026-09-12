-- ═══════════════════════════════════════════════════════════════════════════
-- Vérification des deux coordonnées : email ET téléphone
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Ce qui tenait lieu de vérification ────────────────────────────────────
--
-- Un lien cliqué dans un email. C'est tout. Le clic ouvrait une session et le
-- compte était réputé vérifié. Le numéro de téléphone, lui, n'était jamais
-- vérifié : il suffisait de le saisir.
--
-- C'est une garantie faible. Un lien s'intercepte, se transfère, se clique par
-- un client mail qui précharge les URL. Et surtout : Sikaloc envoie des
-- quittances et des relances sur ce numéro. Un numéro non vérifié, c'est un
-- document qui part chez quelqu'un d'autre.
--
-- ─── Où vit chaque état ────────────────────────────────────────────────────
--
--     email     auth.users.email_confirmed_at     (GoTrue, déjà en place)
--     téléphone bailleurs.telephone_verifie_le    (ajouté ici)
--
-- L'email n'a pas de colonne nouvelle, et c'est volontaire. GoTrue tient déjà
-- cet état, l'expose dans la session (`user.email_confirmed_at`), et le remplit
-- lui-même à la validation de son code. Le dupliquer dans `bailleurs` créerait
-- deux vérités à tenir d'accord — et un jour elles divergeraient.
--
-- ─── Les comptes déjà existants ────────────────────────────────────────────
--
-- Neuf comptes, dont huit à l'email déjà confirmé. Aucun n'a de téléphone
-- vérifié, et aucun ne se voit accorder cette vérification ici : la présence
-- d'un numéro en base ne prouve pas que son propriétaire l'a confirmé. Les
-- huit reprendront donc le parcours à l'étape téléphone, et le neuvième aux
-- deux étapes. C'est exactement ce que demande le cahier des charges.

alter table public.bailleurs
  add column if not exists telephone_verifie_le timestamptz,
  add column if not exists telephone_canal_verification text;

comment on column public.bailleurs.telephone_verifie_le is
  'Validation d''un code OTP envoyé au numéro. NULL = jamais vérifié. Ne jamais renseigner sans validation effective.';
comment on column public.bailleurs.telephone_canal_verification is
  'Canal par lequel le code a été reçu : SMS ou WHATSAPP. Trace de sécurité.';

-- Le canal n'a de sens que s'il y a eu vérification, et l'inverse aussi : les
-- deux colonnes se renseignent ensemble ou pas du tout.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bailleurs_canal_verification_coherent'
  ) then
    alter table public.bailleurs
      add constraint bailleurs_canal_verification_coherent check (
        (telephone_verifie_le is null and telephone_canal_verification is null)
        or (telephone_verifie_le is not null
            and telephone_canal_verification in ('SMS', 'WHATSAPP'))
      );
  end if;
end
$$;

-- ── Les codes ──────────────────────────────────────────────────────────────
--
-- ─── Pourquoi une table, alors que GoTrue en a déjà une ───────────────────
--
-- Pour l'email, Sikaloc ne stocke rien : GoTrue génère, envoie et valide son
-- propre code. Cette table ne sert qu'au téléphone, que GoTrue ne sait pas
-- vérifier ici — aucun fournisseur SMS n'est configuré, et GoTrue ne parle pas
-- WhatsApp.
--
-- La colonne `type` existe quand même avec ses deux valeurs. Non pour faire
-- joli : elle rend la séparation des contextes vérifiable, et laisserait
-- l'email migrer ici un jour sans refaire le schéma.
--
-- ─── Le code n'est jamais stocké ──────────────────────────────────────────
--
-- Seule son empreinte HMAC-SHA256 l'est, calculée avec un secret qui vit dans
-- l'environnement et non en base. Un sel par ligne n'aurait rien protégé :
-- six chiffres, c'est un million de possibilités, qu'on épuise en une
-- milliseconde quand on a le sel sous les yeux. Le secret, lui, ne fuit pas
-- avec la table.
create table if not exists public.codes_verification (
  id uuid primary key default gen_random_uuid(),
  bailleur_id uuid not null references public.bailleurs(id) on delete cascade,

  type text not null check (type in ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION')),
  canal text not null check (canal in ('EMAIL', 'SMS', 'WHATSAPP')),

  -- Ce à quoi le code a été envoyé, tel qu'il l'a été. Sert à refuser un code
  -- demandé pour un numéro et présenté pour un autre.
  destination text not null,

  -- HMAC-SHA256(code, OTP_SECRET). Jamais le code.
  empreinte text not null check (empreinte ~ '^[0-9a-f]{64}$'),

  expire_le timestamptz not null,
  tentatives smallint not null default 0 check (tentatives >= 0),

  -- Consommé : la validation a réussi. Un code utilisé ne resservira pas.
  utilise_le timestamptz,
  -- Périmé par un renvoi : un nouveau code annule le précédent.
  invalide_le timestamptz,

  ip text,
  cree_le timestamptz not null default now()
);

comment on table public.codes_verification is
  'Codes OTP de vérification du téléphone. Empreinte HMAC uniquement, jamais le code en clair.';

-- Le code courant d'un bailleur, et le comptage des demandes récentes pour la
-- limitation de débit : les deux lectures passent par cet index.
create index if not exists idx_codes_verification_recherche
  on public.codes_verification (bailleur_id, type, cree_le desc);

-- ── Personne d'autre que le serveur ────────────────────────────────────────
--
-- RLS activé et AUCUNE politique, AUCUN grant à `authenticated` : suivant le
-- modèle de `tentatives_connexion`. Un navigateur ne peut ni lire une
-- empreinte, ni compter les tentatives, ni remettre un compteur à zéro. Seul
-- le code serveur, muni de `service_role`, touche cette table.
alter table public.codes_verification enable row level security;

revoke all on public.codes_verification from anon, authenticated;

-- ── Ménage ─────────────────────────────────────────────────────────────────
--
-- Un code expiré depuis un jour n'a plus aucune valeur, ni pour l'utilisateur
-- ni pour l'enquête : il ne dit que « quelqu'un a demandé un code ». Les
-- vérifications réussies sont tracées sur `bailleurs`, pas ici.
create or replace function prive.purger_codes_verification()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supprimes integer;
begin
  delete from public.codes_verification
   where cree_le < now() - interval '1 day';

  get diagnostics v_supprimes = row_count;
  return v_supprimes;
end;
$$;

comment on function prive.purger_codes_verification() is
  'Supprime les codes de plus d''un jour. Appelée par la tâche cron de nettoyage.';
