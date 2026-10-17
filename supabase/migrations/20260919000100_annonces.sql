-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S1 — les annonces, et rien d'autre
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Pourquoi une table à côté de `logements`, et pas des colonnes dessus ───
--
-- `logements` est privé et doit le rester : il porte l'adresse exacte, celle
-- des quittances. Une annonce a une autre vie — elle est publiée, suspendue,
-- clôturée, et le même logement en connaîtra plusieurs au fil des locations.
-- Le prix affiché n'est pas non plus le loyer d'un bail signé.
--
-- Les champs publics (type, ville) sont donc RECOPIÉS dans l'annonce à sa
-- création. C'est ce qui permet à une annonce clôturée de survivre à la
-- suppression de son logement, et à la lecture publique de ne jamais toucher
-- `logements`.
--
-- ─── Ce que cette migration n'ouvre pas ────────────────────────────────────
--
-- Rien n'est lisible par un visiteur. Aucune fonction publique, aucun bucket,
-- aucun droit pour `anon`. Les deux tables n'ont que les politiques du
-- bailleur propriétaire, sur le modèle de `logements`. L'ouverture au public
-- viendra en S2, par des fonctions qui énumèrent ce qu'elles rendent.
--
-- ─── Les montants ──────────────────────────────────────────────────────────
--
-- Des entiers, en FCFA. Les montants existants sont en `numeric(12,2)`, mais
-- aucun ne porte de décimale, `formaterNombre` arrondit, et une quittance
-- n'écrit jamais de centimes : le FCFA n'en a pas en circulation. Les
-- anciennes colonnes ne sont pas touchées.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Types ─────────────────────────────────────────────────────────────────

create type public.statut_annonce as enum (
  'brouillon', 'publiee', 'suspendue', 'cloturee'
);

create type public.motif_cloture_annonce as enum (
  'louee_sikaloc', 'louee_ailleurs', 'retiree'
);

-- ─── La référence publique ─────────────────────────────────────────────────
--
-- Dix caractères, 2⁵⁰ possibilités : impossible à énumérer, assez court pour
-- une URL. L'alphabet de Crockford sans i, l, o ni u — les lettres qu'on
-- confond avec 1, 0 ou v en recopiant un lien à la main.
--
-- `gen_random_bytes` et non `random()` : `random()` est prévisible, ce qui
-- convient à un code de parrainage, pas à ce qui garde une annonce hors de
-- portée d'une énumération. Chaque octet est réduit à ses 5 bits de poids
-- faible : 256 étant un multiple de 32, aucun caractère n'est plus probable
-- qu'un autre.
--
-- Pas de boucle de nouveau tirage : la contrainte d'unicité fait foi, et une
-- collision sur 2⁵⁰ n'arrivera pas à l'échelle de Sikaloc. Une boucle aurait
-- dû lire `annonces`, que les politiques rendent partielle pour l'appelant —
-- elle aurait vérifié l'unicité parmi SES annonces seulement.

create or replace function prive.generer_reference_annonce()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789abcdefghjkmnpqrstvwxyz';
  octets bytea := extensions.gen_random_bytes(10);
  reference text := '';
  i int;
begin
  for i in 0 .. 9 loop
    reference := reference || substr(alphabet, 1 + (get_byte(octets, i) & 31), 1);
  end loop;
  return reference;
end;
$$;

comment on function prive.generer_reference_annonce() is
  'Référence publique d''une annonce : 10 caractères base32 (Crockford, sans i/l/o/u), tirés de gen_random_bytes.';

-- ─── Annonces ──────────────────────────────────────────────────────────────

create table public.annonces (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null default prive.generer_reference_annonce(),
  bailleur_id     uuid not null references public.bailleurs (id) on delete cascade,
  -- SET NULL : une annonce clôturée survit à la suppression de son logement.
  -- Une annonce vivante l'en empêche (contrainte `annonces_logement_si_vivante`).
  logement_id     uuid references public.logements (id) on delete set null,
  statut          public.statut_annonce not null default 'brouillon',
  motif_cloture   public.motif_cloture_annonce,
  type            public.type_logement not null,
  ville           text not null,
  quartier        text,
  -- 0 = entrer-coucher ou studio.
  chambres        smallint,
  surface_m2      smallint,
  loyer           integer,
  -- NULL = non précisées, 0 = aucune.
  charges         integer,
  -- La caution. Même nom que dans `baux`, pour la conversion en bail.
  depot_garantie  integer,
  avance_mois     smallint,
  equipements     text[] not null default '{}',
  description     text,
  -- NULL = disponible dès maintenant.
  disponible_le   date,
  publiee_le      timestamptz,
  cloturee_le     timestamptz,
  created_at      timestamptz not null default now(),
  mis_a_jour_le   timestamptz not null default now()
);

comment on table public.annonces is
  'Sikaloc_Find : une mise en location d''un logement. Privée en S1 — seul le bailleur propriétaire la lit.';

alter table public.annonces
  add constraint annonces_reference_key unique (reference);

alter table public.annonces
  add constraint annonces_reference_format
  check (reference ~ '^[0-9a-hjkmnp-tv-z]{10}$');

-- Cible des clés étrangères composites (photos, puis candidatures en S8) :
-- elles vérifient, sans déclencheur, qu'une ligne fille appartient au même
-- bailleur que son annonce.
alter table public.annonces
  add constraint annonces_id_bailleur_key unique (id, bailleur_id);

alter table public.annonces
  add constraint annonces_logement_si_vivante
  check (logement_id is not null or statut = 'cloturee');

alter table public.annonces
  add constraint annonces_motif_cloture_coherent
  check ((statut = 'cloturee') = (motif_cloture is not null));

alter table public.annonces
  add constraint annonces_cloturee_le_coherente
  check ((statut = 'cloturee') = (cloturee_le is not null));

-- Une annonce publiée ou suspendue l'a forcément été au moins une fois.
alter table public.annonces
  add constraint annonces_publiee_le_coherente
  check (statut not in ('publiee', 'suspendue') or publiee_le is not null);

alter table public.annonces
  add constraint annonces_ville_longueur
  check (length(trim(ville)) between 2 and 120);

alter table public.annonces
  add constraint annonces_quartier_longueur
  check (quartier is null or length(trim(quartier)) between 2 and 120);

alter table public.annonces
  add constraint annonces_chambres_bornes check (chambres between 0 and 20);

alter table public.annonces
  add constraint annonces_surface_bornes check (surface_m2 between 5 and 2000);

alter table public.annonces
  add constraint annonces_loyer_bornes check (loyer between 1 and 999999999);

alter table public.annonces
  add constraint annonces_charges_bornes check (charges between 0 and 999999999);

alter table public.annonces
  add constraint annonces_depot_garantie_bornes
  check (depot_garantie between 0 and 999999999);

alter table public.annonces
  add constraint annonces_avance_mois_bornes check (avance_mois between 0 and 24);

alter table public.annonces
  add constraint annonces_description_longueur
  check (description is null or length(trim(description)) between 20 and 3000);

-- Liste fermée. `<@` rejette aussi un élément NULL : il n'est contenu dans
-- rien. Une valeur ajoutée plus tard se déclare ici ET dans
-- `EQUIPEMENTS_ANNONCE` (src/lib/types/database.ts).
alter table public.annonces
  add constraint annonces_equipements_valides
  check (equipements <@ array[
    'eau_courante',
    'electricite',
    'compteur_eau_individuel',
    'compteur_electrique_individuel',
    'douche_interieure',
    'wc_interieur',
    'cuisine_interieure',
    'cour_cloturee',
    'gardien',
    'parking',
    'climatisation'
  ]::text[]);

-- Un brouillon peut être incomplet ; rien d'autre. La présence d'une photo
-- n'y figure pas : elle dépend d'une autre table, et c'est le déclencheur
-- `verifier_publication_annonce` qui la garantit.
alter table public.annonces
  add constraint annonces_complete_hors_brouillon
  check (
    statut = 'brouillon'
    or (
      quartier is not null
      and chambres is not null
      and loyer is not null
      and description is not null
    )
  );

-- Une seule annonce vivante par logement. Les annonces clôturées, elles,
-- s'accumulent : c'est l'historique des mises en location.
create unique index annonces_une_vivante_par_logement
  on public.annonces (logement_id)
  where statut <> 'cloturee';

create index annonces_statut_publiee_le_idx on public.annonces (statut, publiee_le desc);
create index annonces_statut_ville_idx      on public.annonces (statut, ville);
create index annonces_statut_loyer_idx      on public.annonces (statut, loyer);
-- `annonces_id_bailleur_key` commence par `id` : il ne sert pas les
-- recherches par bailleur, que font les politiques et l'espace Pro.
create index annonces_bailleur_id_idx       on public.annonces (bailleur_id);

-- ─── Photos ────────────────────────────────────────────────────────────────

create table public.annonce_photos (
  id           uuid primary key default gen_random_uuid(),
  annonce_id   uuid not null,
  bailleur_id  uuid not null,
  -- Chemin dans le futur bucket privé `annonces` (S2), jamais une URL.
  chemin       text not null,
  -- 0 = photo principale.
  position     smallint not null,
  largeur      smallint not null,
  hauteur      smallint not null,
  type_mime    text not null,
  poids        integer not null,
  created_at   timestamptz not null default now()
);

comment on table public.annonce_photos is
  'Photos d''une annonce, 8 au plus. La position 0 est la photo principale.';

-- Composite : une photo déclarée pour l'annonce de A avec le `bailleur_id` de
-- B ne trouve aucune annonce correspondante, et la clé la refuse.
alter table public.annonce_photos
  add constraint annonce_photos_annonce_fkey
  foreign key (annonce_id, bailleur_id)
  references public.annonces (id, bailleur_id)
  on delete cascade;

alter table public.annonce_photos
  add constraint annonce_photos_chemin_key unique (chemin);

-- Même garde que `bailleurs_photo_chemin_scope`. Les photos seront lues côté
-- serveur avec le client admin, donc hors des politiques Storage : sans cette
-- contrainte, un bailleur pourrait écrire sur sa ligne le chemin d'un fichier
-- appartenant à un autre, et le faire afficher dans son annonce.
alter table public.annonce_photos
  add constraint annonce_photos_chemin_scope
  check (
    chemin ~ (
      '^' || bailleur_id::text || '/' || annonce_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'
    )
  );

-- Le type annoncé et l'extension du chemin disent la même chose.
alter table public.annonce_photos
  add constraint annonce_photos_type_mime_valide
  check (
    (type_mime = 'image/jpeg' and chemin like '%.jpg')
    or (type_mime = 'image/webp' and chemin like '%.webp')
  );

alter table public.annonce_photos
  add constraint annonce_photos_position_bornes check (position between 0 and 7);

-- Huit positions possibles, chacune occupée une fois au plus : huit photos au
-- maximum, garanties par la base même en cas d'envois simultanés.
--
-- DEFERRABLE INITIALLY DEFERRED : l'unicité est vérifiée à la fin de la
-- transaction. Réordonner — échanger la 0 et la 2 — passe par un état
-- intermédiaire où deux photos partagent une position ; vérifiée ligne à
-- ligne, la contrainte refuserait tout échange.
alter table public.annonce_photos
  add constraint annonce_photos_position_unique
  unique (annonce_id, position)
  deferrable initially deferred;

alter table public.annonce_photos
  add constraint annonce_photos_dimensions_bornes
  check (largeur between 200 and 2000 and hauteur between 200 and 2000);

alter table public.annonce_photos
  add constraint annonce_photos_poids_bornes check (poids between 1 and 3145728);

-- ─── Déclencheurs ──────────────────────────────────────────────────────────
--
-- Tous en `SECURITY INVOKER`, comme `prive.verifier_coherence_bail` : ils
-- lisent avec les droits de l'appelant. Un bailleur ne voit que ses propres
-- logements, baux et photos — c'est exactement le périmètre qu'il faut
-- contrôler.

-- ── Le cadre d'une annonce : ce qui ne se réécrit pas, et les dates ────────
--
-- La référence est publique : la changer casserait tout lien déjà partagé.
-- Une annonce clôturée ne revient pas : la republier, c'est en créer une
-- nouvelle — c'est ce qui garde l'historique vrai.
--
-- `publiee_le` est posée au PREMIER passage à « publiée » et n'est plus
-- jamais réécrite, ni par une suspension ni par une modification.

create or replace function prive.encadrer_annonce()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.reference is distinct from old.reference then
      raise exception 'La référence d''une annonce ne change pas.'
        using errcode = 'check_violation';
    end if;

    if old.statut = 'cloturee' and new.statut <> 'cloturee' then
      raise exception 'Une annonce clôturée ne se rouvre pas : publiez-en une nouvelle.'
        using errcode = 'check_violation';
    end if;

    new.publiee_le := coalesce(old.publiee_le, new.publiee_le);
  end if;

  if new.statut = 'publiee' and new.publiee_le is null then
    new.publiee_le := now();
  end if;

  if new.statut = 'cloturee' and new.cloturee_le is null then
    new.cloturee_le := now();
  end if;

  return new;
end;
$$;

create trigger encadrer_annonce
  before insert or update on public.annonces
  for each row execute function prive.encadrer_annonce();

create trigger toucher_annonces
  before update on public.annonces
  for each row execute function prive.toucher_mis_a_jour_le();

-- ── T1 — L'annonce et son logement ont le même bailleur ────────────────────

create or replace function prive.verifier_coherence_annonce()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.logement_id is not null and not exists (
    select 1 from public.logements l
     where l.id = new.logement_id and l.bailleur_id = new.bailleur_id
  ) then
    raise exception 'Le logement sélectionné n''appartient pas à ce bailleur.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger verifier_coherence_annonce
  before insert or update of logement_id, bailleur_id on public.annonces
  for each row execute function prive.verifier_coherence_annonce();

-- ── T2 / T3 — Ce qu'exige une annonce publiée ──────────────────────────────
--
-- Vérifié à chaque écriture d'une annonce publiée, pas seulement au passage :
-- avancer `disponible_le` avant la fin du bail en cours doit être refusé
-- comme l'aurait été la publication elle-même.
--
-- La complétude n'est pas refaite ici : `annonces_complete_hors_brouillon`
-- la garantit déjà, pour tous les statuts.
--
-- Le bail : un bail actif interdit la publication, SAUF s'il a une date de
-- fin et que `disponible_le` tombe après elle — le préavis, où le logement
-- se loue avant d'être libéré.

create or replace function prive.verifier_publication_annonce()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.statut <> 'publiee' then
    return new;
  end if;

  if not exists (
    select 1 from public.annonce_photos p where p.annonce_id = new.id
  ) then
    raise exception 'Une annonce ne se publie pas sans au moins une photo.'
      using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.baux b
     where b.logement_id = new.logement_id
       and b.statut = 'Actif'
       and not (
         b.date_fin is not null
         and new.disponible_le is not null
         and new.disponible_le > b.date_fin
       )
  ) then
    raise exception 'Ce logement a un bail actif : il ne se publie qu''avec une date de disponibilité postérieure à la fin de ce bail.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger verifier_publication_annonce
  before insert or update on public.annonces
  for each row execute function prive.verifier_publication_annonce();

-- ── T7 — Seul un brouillon se supprime ─────────────────────────────────────
--
-- Une annonce qui a été publique a pu être vue, partagée, recevoir des
-- candidatures : elle se clôture, elle ne s'efface pas.
--
-- `pg_trigger_depth() > 1` : la suppression arrive par cascade — un compte
-- bailleur supprimé emporte ses annonces. Bloquer ce chemin rendrait un
-- compte impossible à supprimer dès sa première publication.

create or replace function prive.proteger_suppression_annonce()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  if old.statut <> 'brouillon' then
    raise exception 'Seul un brouillon se supprime. Une annonce publiée se clôture.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

create trigger proteger_suppression_annonce
  before delete on public.annonces
  for each row execute function prive.proteger_suppression_annonce();

-- ── T4 — Une annonce publiée garde au moins une photo ──────────────────────
--
-- Le verrou sur l'annonce sérialise deux suppressions simultanées : sans lui,
-- chacune verrait l'autre photo encore présente, et les deux dernières
-- partiraient ensemble. Il sérialise aussi la suppression avec une
-- publication en cours, qui écrit cette même ligne.
--
-- Même exception que T7 pour la cascade : une annonce qui disparaît emporte
-- ses photos.

create or replace function prive.proteger_derniere_photo()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_statut public.statut_annonce;
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  select a.statut into v_statut
    from public.annonces a
   where a.id = old.annonce_id
     for update;

  if v_statut = 'publiee' and not exists (
    select 1 from public.annonce_photos p
     where p.annonce_id = old.annonce_id and p.id <> old.id
  ) then
    raise exception 'Une annonce publiée garde au moins une photo : ajoutez-en une autre avant de retirer celle-ci.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

create trigger proteger_derniere_photo
  before delete on public.annonce_photos
  for each row execute function prive.proteger_derniere_photo();

-- ── T5 — Un bail devient actif : l'annonce du logement se clôture ──────────
--
-- Sur `baux`, et non dans une action serveur : trois chemins écrivent un bail
-- actif — `creerBail`, `reactiverBail` et la fonction `creer_premier_bail` —
-- et un quatrième viendra en S9. Un déclencheur les couvre tous, y compris
-- ceux qu'on n'a pas encore écrits.
--
-- `louee_ailleurs` : c'est tout ce que la base sait en S1. S9 distinguera la
-- location conclue par une candidature Sikaloc.
--
-- Seules les annonces publiées ou suspendues sont clôturées. Un brouillon n'a
-- jamais été vu : il n'y a rien à retirer, et il peut être incomplet — le
-- clôturer violerait `annonces_complete_hors_brouillon` et ferait échouer la
-- création du bail elle-même. Il reste en place, et `verifier_publication_annonce`
-- l'empêche d'être publié tant que le bail est actif.

create or replace function prive.cloturer_annonce_sur_bail_actif()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.statut <> 'Actif' then
    return new;
  end if;

  -- Une mise à jour qui laisse le bail actif n'en fait pas un nouveau.
  if tg_op = 'UPDATE' and old.statut = 'Actif' then
    return new;
  end if;

  update public.annonces a
     set statut = 'cloturee',
         motif_cloture = 'louee_ailleurs'
   where a.logement_id = new.logement_id
     and a.statut in ('publiee', 'suspendue');

  return new;
end;
$$;

create trigger cloturer_annonce_sur_bail_actif
  after insert or update of statut on public.baux
  for each row execute function prive.cloturer_annonce_sur_bail_actif();

-- ─── Qui voit quoi ─────────────────────────────────────────────────────────
--
-- Le bailleur, ses annonces et leurs photos. Personne d'autre, et aucun droit
-- pour `anon` : les privilèges par défaut du schéma lui accordent TRUNCATE,
-- REFERENCES et TRIGGER sur toute table créée ici, d'où le `revoke all`.

alter table public.annonces       enable row level security;
alter table public.annonce_photos enable row level security;

revoke all on public.annonces       from anon, authenticated;
revoke all on public.annonce_photos from anon, authenticated;

grant select, insert, update, delete on public.annonces       to authenticated;
grant select, insert, update, delete on public.annonce_photos to authenticated;

create policy "Un bailleur lit ses annonces"
  on public.annonces for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

create policy "Un bailleur crée ses annonces"
  on public.annonces for insert
  to authenticated
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur modifie ses annonces"
  on public.annonces for update
  to authenticated
  using ((select auth.uid()) = bailleur_id)
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur supprime ses annonces"
  on public.annonces for delete
  to authenticated
  using ((select auth.uid()) = bailleur_id);

create policy "Un bailleur lit les photos de ses annonces"
  on public.annonce_photos for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

create policy "Un bailleur ajoute des photos à ses annonces"
  on public.annonce_photos for insert
  to authenticated
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur modifie les photos de ses annonces"
  on public.annonce_photos for update
  to authenticated
  using ((select auth.uid()) = bailleur_id)
  with check ((select auth.uid()) = bailleur_id);

create policy "Un bailleur retire les photos de ses annonces"
  on public.annonce_photos for delete
  to authenticated
  using ((select auth.uid()) = bailleur_id);
