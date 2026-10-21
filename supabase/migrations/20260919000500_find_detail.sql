-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S6 — la fiche d'une annonce, et le plan du site
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Deux fonctions de lecture, sur le modèle de S2 : `SECURITY DEFINER`,
-- `search_path` vide, colonnes énumérées, aucune dépendance à l'appelant.
--
-- ─── photos_publiees(reference) ────────────────────────────────────────────
--
-- La galerie a besoin de savoir QUELLES positions existent. Les supposer
-- contiguës (0, 1, 2…) serait faux : une photo retirée laisse un trou, et S4
-- ne comble que la position 0. Huit appels à `photo_publiee` pour sonder les
-- huit places seraient huit allers-retours, et `photo_publiee` rend un chemin
-- qui n'a rien à faire hors du serveur.
--
-- Elle rend donc la liste des positions et leurs dimensions — ce que la page
-- publie déjà, puisque chaque photo est servie par `/find/photo/<réf>/<pos>`.
-- Ni chemin, ni identifiant de photo, ni poids. Ouverte à `anon` comme les
-- autres fonctions de la vitrine : elle n'apprend rien qu'une page publique
-- ne montre pas.
--
-- ─── annonces_publiees_sitemap() ───────────────────────────────────────────
--
-- Le plan du site liste chaque annonce publiée : une requête pour toutes,
-- jamais une par annonce. Deux colonnes : la référence, la date de
-- publication. Plafonnée à 50 000 lignes, la limite d'un fichier sitemap.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.photos_publiees(p_reference text)
returns table (
  "position"  smallint,
  largeur   smallint,
  hauteur   smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.position, p.largeur, p.hauteur
  from public.annonces a
  join public.annonce_photos p on p.annonce_id = a.id
  where p_reference ~ '^[0-9a-hjkmnp-tv-z]{10}$'
    and a.reference = p_reference
    and a.statut = 'publiee'
  order by p.position;
$$;

comment on function public.photos_publiees(text) is
  'Positions et dimensions des photos d''une annonce publiée. Jamais de chemin : chaque photo se lit par /find/photo/<réf>/<position>.';

revoke all on function public.photos_publiees(text) from public;
grant execute on function public.photos_publiees(text) to anon, authenticated;

create or replace function public.annonces_publiees_sitemap()
returns table (
  reference   text,
  publiee_le  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.reference, a.publiee_le
  from public.annonces a
  where a.statut = 'publiee'
  order by a.publiee_le desc, a.reference
  limit 50000;
$$;

comment on function public.annonces_publiees_sitemap() is
  'Références et dates de publication des annonces publiées, pour le plan du site. Rien d''autre.';

revoke all on function public.annonces_publiees_sitemap() from public;
grant execute on function public.annonces_publiees_sitemap() to anon, authenticated;
