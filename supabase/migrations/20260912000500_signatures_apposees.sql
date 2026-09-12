-- =============================================================================
-- Sikaloc — Immuabilité des signatures apposées
--
-- ─── Le problème ────────────────────────────────────────────────────────────
--
-- Le PDF archivé porte déjà la signature, incrustée : c'est la pièce
-- historique, et elle est figée. Mais trois chemins permettaient de la
-- remplacer, parce que la fabrication lit `bailleurs.signature_chemin` — le
-- chemin du MOMENT :
--
--   1. `regenererQuittance` refabrique et écrase le fichier archivé ;
--   2. le repli de `/api/quittances/[id]/pdf` refabrique si le fichier manque ;
--   3. toute future refabrication ferait de même.
--
-- Un bailleur qui changeait de signature puis refabriquait une ancienne
-- quittance obtenait un document différent, sous le même numéro.
--
-- ─── Ce que cette table apporte ─────────────────────────────────────────────
--
-- Une ligne par quittance, écrite à l'émission et jamais modifiable : qui a
-- signé, avec quelle signature, quand, et quelle était l'empreinte du document.
-- La copie de la signature vit sous un préfixe à part, que ni le changement ni
-- la suppression de la signature courante n'atteignent.
--
-- ─── Ce qu'elle n'apporte pas ───────────────────────────────────────────────
--
-- Aucune valeur juridique supplémentaire. Les quittances de Sikaloc portent
-- « signature électronique simple, non qualifiée », et cela reste vrai. Ce
-- dispositif donne de la traçabilité technique : qui, quoi, quand, et si le
-- contenu a bougé depuis. Rien de plus, et rien ne doit le présenter autrement.
-- =============================================================================

create table public.signatures_apposees (
  id               uuid primary key default gen_random_uuid(),

  -- Une quittance ne peut être signée qu'une fois. `on delete cascade` :
  -- l'événement n'a pas de sens sans son document, et une quittance ne se
  -- supprime que par la cascade d'un paiement, elle-même figée après 5 minutes.
  quittance_id     uuid not null unique references public.quittances (id) on delete cascade,

  -- Le COMPTE, pas le nom : c'est lui qui identifie le signataire, et il ne
  -- change pas quand le bailleur renomme son profil.
  bailleur_id      uuid not null references public.bailleurs (id) on delete restrict,

  -- Instantané des informations affichées sur le document. Le bailleur peut
  -- changer de nom demain ; la quittance dira toujours qui l'a signée ce jour-là.
  nom_signataire   text not null check (length(trim(nom_signataire)) between 2 and 120),

  -- Copie figée de la signature, sous `<bailleur_id>/apposees/<quittance_id>.<ext>`.
  -- NULL pour les quittances émises avant ce dispositif : on ignore quelle
  -- signature a servi, et leur attribuer la signature courante serait
  -- précisément la falsification que cette table existe pour empêcher.
  chemin_snapshot  text,

  -- Empreinte du PDF au moment de l'apposition. Comparée plus tard au fichier
  -- archivé, elle dit si le contenu a bougé.
  hash_document    text check (hash_document is null or hash_document ~ '^[0-9a-f]{64}$'),

  -- Empreinte de l'image de signature elle-même : deux quittances signées de la
  -- même main portent la même valeur, ce qui permet de regrouper sans comparer
  -- des fichiers.
  hash_signature   text check (hash_signature is null or hash_signature ~ '^[0-9a-f]{64}$'),

  -- Horodatage SERVEUR. Jamais une date envoyée par le navigateur.
  appose_le        timestamptz not null default now(),

  -- Vrai pour les quittances régularisées après coup, dont on ne connaît ni la
  -- signature ni la date d'apposition réelles. Les distinguer est une question
  -- d'honnêteté : elles n'apportent pas la même garantie.
  retroactif       boolean not null default false,

  constraint signatures_apposees_snapshot_scope check (
    chemin_snapshot is null
    or chemin_snapshot ~ ('^' || bailleur_id::text || '/apposees/[0-9a-f-]{36}\.(png|jpe?g|webp)$')
  )
);

create index signatures_apposees_bailleur_idx on public.signatures_apposees (bailleur_id);

comment on table public.signatures_apposees is
  'Une signature apposée sur un document, figée. Jamais modifiable, jamais '
  'supprimable indépendamment de son document. Traçabilité technique — pas une '
  'garantie juridique.';

-- ─── L'immuabilité, imposée par la base ─────────────────────────────────────
--
-- Masquer un bouton ne protège rien : une requête directe à PostgREST, avec le
-- jeton du bailleur, contournerait l'interface. Ces deux déclencheurs sont la
-- seule barrière qui tienne quel que soit le chemin d'écriture — y compris
-- `service_role`, y compris une erreur de notre propre code.

create or replace function prive.refuser_modification_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'Une signature apposée ne se modifie pas (quittance %).', old.quittance_id
    using errcode = 'check_violation';
end;
$$;

create trigger signatures_apposees_immuable_update
  before update on public.signatures_apposees
  for each row
  execute function prive.refuser_modification_signature();

create or replace function prive.refuser_suppression_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_corrigeable boolean;
begin
  -- Cascade depuis `quittances` : le document disparaît, l'événement avec lui.
  -- C'est la fin du document, pas l'effacement d'une preuve.
  if not exists (select 1 from public.quittances q where q.id = old.quittance_id) then
    return old;
  end if;

  -- La fenêtre de correction de 5 minutes (§6.1.7) autorise déjà à reprendre un
  -- paiement validé, ce qui refabrique son document. Refuser ici aurait créé
  -- une seconde règle, en contradiction avec la première : une correction
  -- légitime serait devenue impossible.
  --
  -- Les deux règles coïncident donc, et sur le MÊME horodatage — celui du
  -- trigger `proteger_paiement_fige`. Passé cinq minutes, le paiement est figé
  -- et sa signature aussi.
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

create trigger signatures_apposees_immuable_delete
  before delete on public.signatures_apposees
  for each row
  execute function prive.refuser_suppression_signature();

-- ─── Accès ──────────────────────────────────────────────────────────────────
--
-- Lecture seule pour le bailleur, sur ses propres lignes. L'écriture est
-- réservée au générateur de documents, qui passe par `service_role` — comme
-- pour `quittances`, dont cette table est le prolongement.

alter table public.signatures_apposees enable row level security;
revoke all on public.signatures_apposees from anon;
grant select on public.signatures_apposees to authenticated;

create policy "Un bailleur lit ses signatures apposées"
  on public.signatures_apposees for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

-- ─── Le coffre des copies figées ────────────────────────────────────────────
--
-- Les copies vivent dans le bucket `signatures` existant, sous le préfixe
-- `apposees/`. La policy de lecture en place couvre déjà ce chemin — le premier
-- segment reste l'identifiant du bailleur.
--
-- Rien n'est ajouté pour l'écriture : elle passe par `service_role`, au moment
-- de l'émission, et un bailleur n'a aucune raison de déposer lui-même dans ce
-- préfixe.

-- ─── Régularisation des quittances déjà émises ──────────────────────────────
--
-- Elles reçoivent un événement, mais SANS copie de signature : on ignore
-- laquelle a servi, et leur attribuer la signature courante du profil serait
-- exactement la substitution que ce dispositif interdit.
--
-- Leur PDF archivé reste la pièce de référence — il porte la signature
-- incrustée. `hash_document` est repris de `quittances.hash_sha256`, calculé
-- sur le fichier réellement déposé, donc authentique.
--
-- `appose_le` reprend `date_generation`, l'horodatage serveur de l'émission.

insert into public.signatures_apposees (
  quittance_id, bailleur_id, nom_signataire, chemin_snapshot,
  hash_document, appose_le, retroactif
)
select
  q.id,
  q.bailleur_id,
  b.nom,
  null,
  q.hash_sha256,
  q.date_generation,
  true
from public.quittances q
join public.bailleurs b on b.id = q.bailleur_id
on conflict (quittance_id) do nothing;
