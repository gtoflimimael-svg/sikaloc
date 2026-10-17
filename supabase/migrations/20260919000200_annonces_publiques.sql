-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S2 — la vitrine : ce qu'un visiteur a le droit de lire
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── La règle ──────────────────────────────────────────────────────────────
--
-- Le public ne reçoit jamais une ligne de `annonces`. Il reçoit ce que trois
-- fonctions énumèrent, colonne par colonne, et rien d'autre. Les tables
-- restent fermées : aucun droit pour `anon`, et les politiques de S1 ne
-- rendent à `authenticated` que ses propres annonces.
--
-- ─── Pourquoi des fonctions, et pas des droits par colonne ─────────────────
--
-- Un droit de colonne vaut pour un rôle, pas pour une ligne. Le bailleur a
-- besoin de TOUTES les colonnes de ses annonces : il faudrait les accorder à
-- `authenticated`, et tout utilisateur connecté lirait alors `bailleur_id` et
-- `logement_id` de chaque annonce publiée.
--
-- Pas de vue `SECURITY DEFINER` non plus : l'outil d'audit de Supabase la
-- signale, et une vue se lit avec `select *` — la colonne sensible ajoutée
-- demain à la vue y passerait sans bruit. Une fonction déclare son retour.
--
-- ─── Ce que ces fonctions ne font pas ──────────────────────────────────────
--
-- Elles ne lisent jamais `auth.uid()`. Une annonce publiée appartient au
-- catalogue, quel que soit celui qui regarde : un bailleur connecté ne voit
-- pas ses brouillons par ici, et un visiteur voit exactement ce que voit un
-- compte.
--
-- Elles ne rendent aucune photo : le bucket et la route qui les serviront
-- sont l'objet d'une étape à part. Pas de colonne qui annoncerait une photo
-- qu'on ne peut pas encore montrer.
--
-- `SECURITY DEFINER` parce que le visiteur n'a aucun droit sur les tables :
-- c'est la fonction elle-même qui trace la frontière, par sa clause `where`
-- et par sa liste de colonnes. `search_path = ''` et des noms entièrement
-- qualifiés : l'appelant ne peut substituer aucun objet à ceux qu'elle lit.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Le nom affiché ────────────────────────────────────────────────────────
--
-- « Koffi Adjovi » devient « Koffi A. ». `bailleurs.nom` est un champ unique,
-- sans prénom séparé : le premier mot tient lieu de prénom, l'initiale du
-- dernier de nom. C'est une approximation assumée — elle ne publie jamais le
-- nom complet d'une personne qui en a donné deux.
--
-- Un nom d'un seul mot est rendu tel quel : il n'y a rien à réduire, et une
-- initiale seule ne dirait plus rien.

create or replace function prive.nom_public(p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when m.mots is null then null
    when cardinality(m.mots) = 1 then m.mots[1]
    else m.mots[1] || ' ' || upper(left(m.mots[cardinality(m.mots)], 1)) || '.'
  end
  from (
    select regexp_split_to_array(nullif(trim(p_nom), ''), '\s+') as mots
  ) m;
$$;

comment on function prive.nom_public(text) is
  'Forme publique d''un nom : premier mot et initiale du dernier (« Koffi A. »). Jamais le nom complet.';

revoke all on function prive.nom_public(text) from public;

-- ─── Le catalogue ──────────────────────────────────────────────────────────
--
-- Les annonces publiées, les plus récentes d'abord. La référence départage
-- deux publications de la même seconde : sans elle, une page pourrait
-- répéter ou sauter une annonce d'un appel à l'autre.
--
-- La pagination est bornée ici, pas chez l'appelant : 48 au plus par appel.
-- Les filtres viendront avec la recherche ; leur sens n'est pas encore
-- arrêté (normalisation des villes notamment), et un filtre mal défini
-- aujourd'hui serait un contrat difficile à reprendre demain.

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
  publiee_le      timestamptz
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
    a.publiee_le
  from public.annonces a
  where a.statut = 'publiee'
  order by a.publiee_le desc, a.reference
  limit least(greatest(coalesce(p_limite, 24), 1), 48)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

comment on function public.annonces_publiees(integer, integer) is
  'Catalogue Sikaloc_Find : annonces publiées, colonnes publiques uniquement. Ne dépend pas de l''appelant.';

revoke all on function public.annonces_publiees(integer, integer) from public;
grant execute on function public.annonces_publiees(integer, integer) to anon, authenticated;

-- ─── Une annonce ───────────────────────────────────────────────────────────
--
-- Par sa référence, seule clé publique. Une annonce brouillon, suspendue,
-- clôturée ou inexistante rend la même chose : rien. L'application en fera
-- une 404, sans pouvoir distinguer ces cas — et un visiteur non plus.
--
-- Le format est vérifié avant la recherche : une chaîne qui ne peut pas être
-- une référence ne mérite pas une lecture d'index.

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
  publiee_le      timestamptz
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
    a.publiee_le
  from public.annonces a
  where p_reference ~ '^[0-9a-hjkmnp-tv-z]{10}$'
    and a.reference = p_reference
    and a.statut = 'publiee';
$$;

comment on function public.annonce_publiee(text) is
  'Une annonce Sikaloc_Find par sa référence, si et seulement si elle est publiée. Colonnes publiques uniquement.';

revoke all on function public.annonce_publiee(text) from public;
grant execute on function public.annonce_publiee(text) to anon, authenticated;

-- ─── Le bailleur, vu depuis une annonce ────────────────────────────────────
--
-- Désigné par la référence de l'annonce, jamais par un identifiant de
-- bailleur : la fonction ne donne rien sur quelqu'un qui n'a pas d'annonce
-- publiée, et n'offre aucun moyen de parcourir les comptes.
--
-- Deux informations, pas une de plus :
--
--   nom_affiche        la forme réduite (voir `prive.nom_public`) ;
--   telephone_verifie  vrai seulement si un CODE a été reçu par SMS ou
--                      WhatsApp. Le canal ADMIN — une attestation posée à la
--                      main, sans qu'aucun code ait circulé — ne compte pas :
--                      la migration qui l'a créé le dit plus faible, et la
--                      page publique ne doit pas le présenter autrement.
--
-- Ni téléphone, ni email, ni adresse, ni photo. Aucune mention d'identité
-- vérifiée : rien, dans Sikaloc, ne vérifie une identité.

create or replace function public.profil_public_bailleur(p_reference text)
returns table (
  nom_affiche        text,
  telephone_verifie  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    prive.nom_public(b.nom),
    (
      b.telephone_verifie_le is not null
      and b.telephone_canal_verification in ('SMS', 'WHATSAPP')
    )
  from public.annonces a
  join public.bailleurs b on b.id = a.bailleur_id
  where p_reference ~ '^[0-9a-hjkmnp-tv-z]{10}$'
    and a.reference = p_reference
    and a.statut = 'publiee';
$$;

comment on function public.profil_public_bailleur(text) is
  'Profil public minimal du bailleur d''une annonce publiée : nom réduit, téléphone vérifié par code. Rien d''autre.';

revoke all on function public.profil_public_bailleur(text) from public;
grant execute on function public.profil_public_bailleur(text) to anon, authenticated;
