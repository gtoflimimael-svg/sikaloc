-- =============================================================================
-- Sikaloc — Cycle de grâce en cas d'impayé d'abonnement
-- Référence : Sika_MVPmàj_v2.1.md §4 (et spec v2.0 §4.4)
--
--   J+0   échec de prélèvement  → grace         + email de rappel
--   J+3   accès en lecture seule → lecture_seule + email
--   J+30  compte suspendu        → suspendu      + email
--   J+90  purge des données      → supprime      + email
--
-- Les transitions sont calculées en SQL (fiable, rejouable) ; l'envoi des
-- emails passe par une file que l'application vide via Resend. Ce découplage
-- évite de faire dépendre l'intégrité des statuts d'un service tiers.
-- =============================================================================

create type public.statut_abonnement as enum (
  'actif', 'grace', 'lecture_seule', 'suspendu', 'supprime'
);

alter table public.bailleurs
  add column statut_abonnement      public.statut_abonnement not null default 'actif',
  add column date_echec_paiement    timestamptz,
  add column dernier_rappel_envoye  timestamptz;

create index bailleurs_cycle_grace_idx
  on public.bailleurs (statut_abonnement, date_echec_paiement)
  where date_echec_paiement is not null;

comment on column public.bailleurs.statut_abonnement is
  'Étape du cycle de grâce. Pilote les droits d''écriture dans l''application.';

-- ─── File d'emails ──────────────────────────────────────────────────────────

create table public.emails_a_envoyer (
  id              uuid primary key default gen_random_uuid(),
  bailleur_id     uuid not null references public.bailleurs (id) on delete cascade,
  destinataire    text not null,
  modele          text not null,
  variables       jsonb not null default '{}'::jsonb,
  cree_le         timestamptz not null default now(),
  envoye_le       timestamptz,
  tentatives      smallint not null default 0,
  derniere_erreur text
);

create index emails_a_envoyer_en_attente_idx
  on public.emails_a_envoyer (cree_le)
  where envoye_le is null;

-- Un même palier ne produit qu'un seul email par bailleur.
create unique index emails_a_envoyer_unicite_palier
  on public.emails_a_envoyer (bailleur_id, modele);

alter table public.emails_a_envoyer enable row level security;
revoke all on public.emails_a_envoyer from anon, authenticated;

comment on table public.emails_a_envoyer is
  'File d''envoi, réservée au service_role : elle contient des adresses.';

-- ─── Journal des purges ─────────────────────────────────────────────────────

create table public.journal_purges (
  id                    uuid primary key default gen_random_uuid(),
  bailleur_id           uuid not null,
  locataires_anonymises integer not null default 0,
  documents_supprimes   integer not null default 0,
  fichiers_a_supprimer  text[] not null default '{}',
  fichiers_supprimes_le timestamptz,
  purge_le              timestamptz not null default now()
);

alter table public.journal_purges enable row level security;
revoke all on public.journal_purges from anon, authenticated;

-- ─── Transitions de statut ──────────────────────────────────────────────────
--
-- Les colonnes de sortie portent un préfixe `out_` : nommées `bailleur_id`,
-- elles entreraient en collision avec les colonnes des tables manipulées et
-- PL/pgSQL rejetterait `on conflict (bailleur_id, …)` comme ambigu.

create function prive.appliquer_cycle_grace()
returns table (out_bailleur uuid, out_ancien text, out_nouveau text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne    record;
  v_jours  integer;
  v_cible  public.statut_abonnement;
  v_modele text;
begin
  for ligne in
    select b.id, b.email, b.nom, b.statut_abonnement, b.date_echec_paiement
      from public.bailleurs b
     where b.date_echec_paiement is not null
       and b.statut_abonnement <> 'supprime'
  loop
    v_jours := (current_date - ligne.date_echec_paiement::date);

    v_cible := case
      when v_jours >= 90 then 'supprime'::public.statut_abonnement
      when v_jours >= 30 then 'suspendu'::public.statut_abonnement
      when v_jours >= 3  then 'lecture_seule'::public.statut_abonnement
      else                    'grace'::public.statut_abonnement
    end;

    -- Idempotence : la fonction peut tourner plusieurs fois par jour sans
    -- effet de bord.
    continue when v_cible = ligne.statut_abonnement;

    update public.bailleurs
       set statut_abonnement     = v_cible,
           dernier_rappel_envoye = now()
     where id = ligne.id;

    v_modele := case v_cible
      when 'grace'         then 'grace_j0'
      when 'lecture_seule' then 'grace_j3'
      when 'suspendu'      then 'grace_j30'
      when 'supprime'      then 'purge_j90'
    end;

    insert into public.emails_a_envoyer (bailleur_id, destinataire, modele, variables)
    values (
      ligne.id, ligne.email, v_modele,
      jsonb_build_object(
        'nom', ligne.nom,
        'jours', v_jours,
        'date_echec', ligne.date_echec_paiement::date
      )
    )
    on conflict (bailleur_id, modele) do nothing;

    out_bailleur := ligne.id;
    out_ancien   := ligne.statut_abonnement::text;
    out_nouveau  := v_cible::text;
    return next;
  end loop;
end;
$$;

comment on function prive.appliquer_cycle_grace() is
  'Fait progresser les comptes en impayé et alimente la file d''emails. '
  'Idempotente : n''agit que lorsqu''un palier est franchi.';

-- ─── Purge des données personnelles à J+90 ──────────────────────────────────
--
-- Supabase refuse toute suppression directe dans `storage.objects`
-- (`storage.protect_delete`) : les fichiers passent obligatoirement par l'API
-- Storage. La purge est donc scindée en deux temps :
--   1. ici — anonymisation, détachement des documents, relevé des fichiers ;
--   2. /api/cron/purge — effacement réel des objets, puis marquage du journal.
--
-- Ce découpage a un mérite : la partie irréversible côté base est
-- transactionnelle, et l'effacement des fichiers peut être rejoué s'il échoue,
-- sans jamais purger deux fois les mêmes données.
--
-- Les locataires sont anonymisés et non supprimés : baux et paiements sont des
-- pièces comptables que le bailleur peut avoir à produire.

create function prive.purger_donnees_personnelles()
returns table (out_bailleur uuid, out_locataires integer, out_fichiers integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne        record;
  v_locataires integer;
  v_fichiers   text[];
begin
  for ligne in
    select b.id
      from public.bailleurs b
     where b.statut_abonnement = 'supprime'
       and b.date_echec_paiement is not null
       and (current_date - b.date_echec_paiement::date) >= 90
       -- Ne purge qu'une fois.
       and not exists (
         select 1 from public.journal_purges j where j.bailleur_id = b.id
       )
  loop
    update public.locataires
       set nom = 'Locataire anonymisé', telephone = '00000000', email = null
     where locataires.bailleur_id = ligne.id;
    get diagnostics v_locataires = row_count;

    -- Lecture seule : on relève les chemins, l'effacement revient à l'API.
    select coalesce(array_agg(o.bucket_id || '/' || o.name), '{}')
      into v_fichiers
      from storage.objects o
     where o.bucket_id in ('quittances', 'signatures')
       and (storage.foldername(o.name))[1] = ligne.id::text;

    update public.quittances set pdf_chemin = null
     where quittances.bailleur_id = ligne.id;

    update public.bailleurs set signature_chemin = null, adresse = null
     where id = ligne.id;

    insert into public.journal_purges (
      bailleur_id, locataires_anonymises, documents_supprimes, fichiers_a_supprimer
    )
    values (ligne.id, v_locataires, coalesce(array_length(v_fichiers, 1), 0), v_fichiers);

    out_bailleur   := ligne.id;
    out_locataires := v_locataires;
    out_fichiers   := coalesce(array_length(v_fichiers, 1), 0);
    return next;
  end loop;
end;
$$;

comment on function prive.purger_donnees_personnelles() is
  'Purge J+90, volet base. Les fichiers sont relevés dans '
  'journal_purges.fichiers_a_supprimer et effacés par /api/cron/purge.';

-- ─── Retour à la normale après paiement ─────────────────────────────────────

create function prive.reactiver_abonnement(p_bailleur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bailleurs
     set statut_abonnement     = 'actif',
         date_echec_paiement   = null,
         dernier_rappel_envoye = null
   where id = p_bailleur;

  -- Les rappels du cycle écoulé sont retirés pour qu'un futur impayé puisse
  -- en réémettre.
  delete from public.emails_a_envoyer
   where emails_a_envoyer.bailleur_id = p_bailleur
     and modele in ('grace_j0', 'grace_j3', 'grace_j30', 'purge_j90');
end;
$$;

-- ─── Planification quotidienne ──────────────────────────────────────────────
-- 03:00 UTC, soit 04:00 à Cotonou — hors des heures d'usage. La purge tourne
-- une heure plus tard, pour que les statuts du jour soient déjà arrêtés.

create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'sika-cycle-grace',
  '0 3 * * *',
  $$ select prive.appliquer_cycle_grace(); $$
);

select cron.schedule(
  'sika-purge-j90',
  '0 4 * * *',
  $$ select prive.purger_donnees_personnelles(); $$
);
