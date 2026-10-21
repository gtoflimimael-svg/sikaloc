-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S5 — le catalogue public et ses photos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Ce qui change dans la vitrine de S2 ───────────────────────────────────
--
-- `annonces_publiees` et `annonce_publiee` gagnent trois colonnes : la
-- position de la photo principale, sa largeur, sa hauteur. Rien d'autre —
-- pas de chemin de stockage, pas d'identifiant de photo.
--
-- Pourquoi dans la projection existante plutôt qu'une fonction de plus : le
-- catalogue affiche une photo par carte. Une seconde fonction par annonce
-- ferait vingt-quatre appels par page ; une fonction « photos d'un lot de
-- références » dupliquerait la frontière publique en deux endroits qui
-- finiraient par diverger. La photo principale est une propriété publique de
-- l'annonce publiée : elle a sa place dans sa projection.
--
-- La position n'est pas supposée valoir 0. S4 promeut la photo suivante quand
-- la principale est retirée, mais la base ne l'impose pas : c'est la plus
-- petite position présente qui est rendue. Une annonce publiée en a toujours
-- une (déclencheurs de S1).
--
-- Le type de retour change : PostgreSQL impose de supprimer puis recréer. Les
-- droits sont reposés à l'identique.
--
-- ─── Ce qui s'ajoute, et à qui ─────────────────────────────────────────────
--
-- `photo_publiee(reference, position)` rend le chemin interne d'une photo —
-- d'une annonce PUBLIÉE seulement. Elle n'est exécutable que par la clé de
-- service : c'est la route serveur `/find/photo/…` qui l'appelle, lit le
-- fichier, et le renvoie sans jamais montrer le chemin.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.annonces_publiees(integer, integer);
drop function if exists public.annonce_publiee(text);

create or replace function public.annonces_publiees(
  p_limite   integer default 24,
  p_decalage integer default 0
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
  order by a.publiee_le desc, a.reference
  limit least(greatest(coalesce(p_limite, 24), 1), 48)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

comment on function public.annonces_publiees(integer, integer) is
  'Catalogue Sikaloc_Find : annonces publiées, colonnes publiques et métadonnées de la photo principale (jamais son chemin).';

revoke all on function public.annonces_publiees(integer, integer) from public;
grant execute on function public.annonces_publiees(integer, integer) to anon, authenticated;

create or replace function public.annonce_publiee(p_reference text)
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
  where p_reference ~ '^[0-9a-hjkmnp-tv-z]{10}$'
    and a.reference = p_reference
    and a.statut = 'publiee';
$$;

comment on function public.annonce_publiee(text) is
  'Une annonce Sikaloc_Find par sa référence, si et seulement si elle est publiée. Colonnes publiques uniquement.';

revoke all on function public.annonce_publiee(text) from public;
grant execute on function public.annonce_publiee(text) to anon, authenticated;

-- ─── Le chemin d'une photo publiée — pour le serveur seul ──────────────────
--
-- Référence et position valident leur forme avant toute lecture. Une annonce
-- brouillon, suspendue, clôturée, une position vide, une référence inconnue :
-- la même réponse, rien.
--
-- Aucun droit pour `anon` ni `authenticated`, même par erreur : le chemin
-- contient les identifiants du bailleur et de l'annonce, que la vitrine ne
-- publie jamais.

create or replace function public.photo_publiee(p_reference text, p_position integer)
returns table (
  chemin     text,
  type_mime  text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.chemin, p.type_mime
  from public.annonces a
  join public.annonce_photos p on p.annonce_id = a.id
  where p_reference ~ '^[0-9a-hjkmnp-tv-z]{10}$'
    and p_position between 0 and 7
    and a.reference = p_reference
    and a.statut = 'publiee'
    and p.position = p_position;
$$;

comment on function public.photo_publiee(text, integer) is
  'Chemin interne d''une photo d''annonce publiée. Réservée à la clé de service (route /find/photo). Jamais au public.';

revoke all on function public.photo_publiee(text, integer) from public, anon, authenticated;
grant execute on function public.photo_publiee(text, integer) to service_role;
