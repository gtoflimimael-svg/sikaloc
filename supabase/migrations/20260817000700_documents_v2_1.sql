-- =============================================================================
-- Sikaloc — Corrections v2.1 sur les documents émis
-- Référence : Sika_MVPmàj_v2.1.md §2 (validation juridique)
--
-- 1. Numérotation séquentielle par bailleur au format AAAA-NNNN, attribuée de
--    façon atomique.
-- 2. Empreinte SHA-256 du fichier PDF, pour vérifier a posteriori qu'un
--    document reçu n'a pas été altéré.
-- =============================================================================

-- ─── Compteur de documents ──────────────────────────────────────────────────
-- Une ligne par (bailleur, année) : la numérotation repart à 0001 chaque année,
-- comme le veut l'usage comptable.

create table public.compteurs_documents (
  bailleur_id     uuid     not null references public.bailleurs (id) on delete cascade,
  annee           smallint not null check (annee between 2000 and 2200),
  dernier_numero  integer  not null default 0 check (dernier_numero >= 0),
  primary key (bailleur_id, annee)
);

alter table public.compteurs_documents enable row level security;
revoke all on public.compteurs_documents from anon, authenticated;

comment on table public.compteurs_documents is
  'Séquence de numérotation des quittances, par bailleur et par année. '
  'Écrite uniquement par le trigger attribuer_numero_document.';

-- ─── Attribution atomique du numéro ─────────────────────────────────────────
--
-- `insert … on conflict do update … returning` est exécuté en une seule
-- opération : Postgres pose un verrou de ligne sur le compteur, ce qui rend
-- impossible d'attribuer deux fois le même numéro, même si deux quittances
-- sont émises au même instant pour le même bailleur.
--
-- C'est ce point qui avait motivé le choix d'un numéro aléatoire en v2.0 ; la
-- séquence est ici sûre parce qu'elle vit dans la base et non dans
-- l'application.

create or replace function prive.attribuer_numero_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_annee  smallint;
  v_numero integer;
begin
  -- Régénération d'un document existant : on conserve son numéro d'origine.
  if new.numero_document is not null and new.numero_document <> '' then
    return new;
  end if;

  v_annee := extract(year from coalesce(new.date_generation, now()))::smallint;

  insert into public.compteurs_documents (bailleur_id, annee, dernier_numero)
  values (new.bailleur_id, v_annee, 1)
  on conflict (bailleur_id, annee)
  do update set dernier_numero = public.compteurs_documents.dernier_numero + 1
  returning dernier_numero into v_numero;

  -- Au-delà de 9 999 documents dans l'année, le numéro s'allonge naturellement
  -- plutôt que de déborder ou de se répéter.
  new.numero_document := v_annee::text || '-' || lpad(v_numero::text, 4, '0');

  return new;
end;
$$;

create trigger attribuer_numero_document
  before insert on public.quittances
  for each row
  execute function prive.attribuer_numero_document();

-- ─── Le numéro devient unique par bailleur, non plus globalement ────────────
-- Deux bailleurs distincts émettent chacun leur 2026-0001 : c'est le principe
-- même d'une numérotation propre à chaque émetteur.

alter table public.quittances
  drop constraint if exists quittances_numero_document_key;

alter table public.quittances
  add constraint quittances_numero_unique_par_bailleur
  unique (bailleur_id, numero_document);

-- Le trigger renseigne la colonne : elle doit accepter NULL le temps de
-- l'insertion (les contraintes NOT NULL sont évaluées après les triggers
-- BEFORE, mais l'application, elle, envoie explicitement NULL).
alter table public.quittances
  alter column numero_document drop not null;

-- ─── Intégrité du fichier ───────────────────────────────────────────────────

alter table public.quittances
  add column hash_sha256 text
    check (hash_sha256 is null or hash_sha256 ~ '^[0-9a-f]{64}$');

comment on column public.quittances.hash_sha256 is
  'Empreinte SHA-256 du PDF déposé dans le coffre. Permet de vérifier qu''un '
  'document reçu par un locataire est bien celui qui a été émis.';

-- `date_generation` porte déjà `default now()` : l''horodatage vient donc de
-- l''horloge de la base, jamais du poste du bailleur (v2.1 §2.4).
comment on column public.quittances.date_generation is
  'Horodatage serveur (now() de Postgres). Ne jamais renseigner depuis le client.';
