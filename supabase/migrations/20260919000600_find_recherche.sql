-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S7 — la recherche
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Une recherche, une fonction ───────────────────────────────────────────
--
-- `annonces_recherche` est `annonces_publiees` avec des filtres : même
-- projection, même tri, même plafond. Un paramètre à NULL ne filtre rien, si
-- bien que l'appel sans aucun filtre rend exactement le catalogue de S5 —
-- c'est ce qui permet à la page de n'avoir qu'un seul chemin de code.
--
-- `annonces_publiees` reste en place : elle est la porte simple de la vitrine
-- (S2), et rien n'oblige un appelant à connaître douze paramètres.
--
-- ─── Ce que chaque filtre veut dire ────────────────────────────────────────
--
--   ville, quartier   égalité, espaces et casse mis de côté : « cotonou »,
--                     « Cotonou » et « Cotonou » (avec espaces) sont le même
--                     lieu. Les valeurs proposées viennent de `lieux_publies`,
--                     donc l'égalité suffit — pas de recherche approximative.
--   type              une valeur de l'énumération, telle quelle.
--   loyer_min/max     loyer >= / <= (bornes incluses).
--   chambres          égalité EXACTE. Une annonce sans nombre de chambres est
--                     donc exclue dès que le filtre est posé — comme pour la
--                     surface.
--   surface_min/max   surface_m2 >= / <=. Une annonce sans surface est exclue
--                     quand le filtre est posé : on ne devine pas une valeur
--                     absente.
--   disponible        « maintenant » : `disponible_le` vide (donc disponible)
--                     ou déjà passée.
--   equipements       le logement possède TOUS ceux demandés (`@>`), jamais
--                     « au moins un ». Un filtre qui élargit au lieu de
--                     restreindre trompe celui qui le pose.
--
-- ─── Index ─────────────────────────────────────────────────────────────────
--
-- Aucun index ajouté. Ceux de S1 couvrent le tri (`statut, publiee_le desc`)
-- et le prix ; la comparaison normalisée de la ville n'utilise pas
-- `annonces_statut_ville_idx`, mais à l'échelle actuelle — quelques dizaines
-- d'annonces publiées — PostgreSQL balaie la table de toute façon. Un index
-- d'expression sur `lower(btrim(ville))` et un index GIN sur `equipements`
-- deviendront utiles autour du millier d'annonces publiées ; les poser
-- aujourd'hui, ce serait de l'entretien sans gain mesurable.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.annonces_recherche(
  p_ville          text    default null,
  p_quartier       text    default null,
  p_type           public.type_logement default null,
  p_loyer_min      integer default null,
  p_loyer_max      integer default null,
  p_chambres       smallint default null,
  p_surface_min    smallint default null,
  p_surface_max    smallint default null,
  p_disponible     boolean default null,
  p_equipements    text[]  default null,
  p_limite         integer default 24,
  p_decalage       integer default 0
)
returns table (
  reference       text,
  type            public.type_logement,
  ville           text,
  quartier        text,
  chambres        smallint,
  surface_m2      smallint,
  loyer           integer,
  charges         integer,
  depot_garantie  integer,
  avance_mois     smallint,
  equipements     text[],
  description     text,
  disponible_le   date,
  publiee_le      timestamptz,
  photo_position  smallint,
  photo_largeur   smallint,
  photo_hauteur   smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.reference,
    a.type,
    a.ville,
    a.quartier,
    a.chambres,
    a.surface_m2,
    a.loyer,
    a.charges,
    a.depot_garantie,
    a.avance_mois,
    a.equipements,
    a.description,
    a.disponible_le,
    a.publiee_le,
    ph.position,
    ph.largeur,
    ph.hauteur
  from public.annonces a
  left join lateral (
    select p.position, p.largeur, p.hauteur
      from public.annonce_photos p
     where p.annonce_id = a.id
     order by p.position
     limit 1
  ) ph on true
  where a.statut = 'publiee'
    and (p_ville is null or lower(btrim(a.ville)) = lower(btrim(p_ville)))
    and (p_quartier is null or lower(btrim(coalesce(a.quartier, ''))) = lower(btrim(p_quartier)))
    and (p_type is null or a.type = p_type)
    and (p_loyer_min is null or a.loyer >= p_loyer_min)
    and (p_loyer_max is null or a.loyer <= p_loyer_max)
    and (p_chambres is null or a.chambres = p_chambres)
    and (p_surface_min is null or a.surface_m2 >= p_surface_min)
    and (p_surface_max is null or a.surface_m2 <= p_surface_max)
    and (
      p_disponible is not true
      or a.disponible_le is null
      or a.disponible_le <= current_date
    )
    and (
      p_equipements is null
      or cardinality(p_equipements) = 0
      or a.equipements @> p_equipements
    )
  order by a.publiee_le desc, a.reference
  limit least(greatest(coalesce(p_limite, 24), 1), 48)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

comment on function public.annonces_recherche is
  'Recherche Sikaloc_Find : mêmes colonnes publiques que annonces_publiees, filtrées. Un paramètre NULL ne filtre rien.';

revoke all on function public.annonces_recherche(
  text, text, public.type_logement, integer, integer, smallint, smallint, smallint, boolean, text[], integer, integer
) from public;
grant execute on function public.annonces_recherche(
  text, text, public.type_logement, integer, integer, smallint, smallint, smallint, boolean, text[], integer, integer
) to anon, authenticated;

-- ─── Les lieux réellement publiés ──────────────────────────────────────────
--
-- Les listes de villes et de quartiers ne sont pas une table à part : elles se
-- déduisent des annonces publiées, et n'existent donc que tant qu'une annonce
-- les porte.
--
-- Le regroupement se fait sur la forme normalisée, l'affichage sur une
-- orthographe réellement saisie (`min`, donc stable d'un appel à l'autre) :
-- « cotonou » et « Cotonou » ne font qu'une ligne, et le filtre les retrouve
-- toutes les deux.

create or replace function public.lieux_publies()
returns table (
  ville     text,
  quartier  text
)
language sql
stable
security definer
set search_path = ''
as $$
  with publiees as (
    select
      btrim(a.ville) as ville,
      btrim(a.quartier) as quartier,
      lower(btrim(a.ville)) as cle_ville,
      lower(btrim(a.quartier)) as cle_quartier
    from public.annonces a
    where a.statut = 'publiee'
  )
  select min(p.ville) as ville, min(p.quartier) as quartier
  from publiees p
  group by p.cle_ville, p.cle_quartier
  order by 1, 2;
$$;

comment on function public.lieux_publies() is
  'Villes et quartiers des annonces publiées, dédoublonnés sans tenir compte de la casse ni des espaces.';

revoke all on function public.lieux_publies() from public;
grant execute on function public.lieux_publies() to anon, authenticated;
