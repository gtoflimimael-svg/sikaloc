-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S8-C — les candidatures vues par le bailleur
-- ═══════════════════════════════════════════════════════════════════════════
--
-- S8-A a posé les règles : qui peut lire, qui peut répondre, quelles
-- transitions sont permises. Rien de tout cela ne bouge ici.
--
-- Cette migration ajoute les deux seules choses que l'écran de Sikaloc_Pro ne
-- pouvait pas obtenir sans elle :
--
--   1. un COMPTEUR par annonce, en une seule requête ;
--   2. une BORNE sur la liste d'une annonce.
--
-- ─── Pourquoi un compteur en SQL plutôt qu'un décompte côté serveur ────────
--
-- La liste des annonces affiche « 3 candidatures · 2 nouvelles » sur chaque
-- carte. Interroger une fois par annonce, c'est une requête par carte — le
-- N+1 classique, invisible avec trois annonces et coûteux avec cinquante.
--
-- Rapatrier toutes les candidatures pour les compter en JavaScript reviendrait
-- à transporter chaque message, chaque nom, chaque date pour n'en garder que
-- le nombre : le pire des deux mondes. `group by` fait cela là où sont les
-- données, et ne rend que des entiers.
--
-- Le compteur n'est PAS dénormalisé dans `annonces` : une colonne à tenir à
-- jour par déclencheur se désynchronise un jour, et rien ici ne demande cette
-- vitesse.
--
-- ─── Pourquoi une borne sur la liste ──────────────────────────────────────
--
-- `candidatures_de_mes_annonces` rendait tout, sans limite. Une annonce très
-- demandée aurait servi des centaines de messages d'un coup, à chaque
-- affichage. La fonction garde exactement sa signature d'origine — deux
-- paramètres à valeur par défaut s'ajoutent, et un appel écrit en S8-A
-- continue de rendre ce qu'il rendait.
--
-- L'ordre reste `created_at desc` : les plus récentes d'abord, comme en S8-A,
-- et c'est déjà l'ordre de l'index `candidatures_annonce_idx`.

-- ─── Le compteur ───────────────────────────────────────────────────────────
--
-- `security definer` pour la même raison qu'en S8-A : la fonction lit la
-- jointure `annonces` → `candidatures` et ne rend que des nombres. Le filtre
-- sur `auth.uid()` est DANS la requête — elle ne compte jamais que les
-- annonces du bailleur connecté, quel que soit l'appelant.
--
-- Les annonces sans candidature n'apparaissent pas : une ligne absente vaut
-- zéro, et l'écran le sait.

create or replace function public.candidatures_par_annonce()
returns table (
  annonce_id uuid,
  total      integer,
  nouvelles  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.annonce_id,
    count(*)::integer,
    count(*) filter (where c.statut = 'envoyee')::integer
  from public.candidatures c
  join public.annonces a on a.id = c.annonce_id
  where a.bailleur_id = (select auth.uid())
  group by c.annonce_id;
$$;

revoke all on function public.candidatures_par_annonce() from public, anon;
grant execute on function public.candidatures_par_annonce() to authenticated;

comment on function public.candidatures_par_annonce() is
  'Nombre de candidatures par annonce du bailleur connecté, et combien sont encore sans réponse.';

-- ─── La liste, bornée ──────────────────────────────────────────────────────
--
-- Mêmes colonnes, même ordre, mêmes droits qu'en S8-A. `p_limite` à NULL rend
-- tout, comme avant ; l'écran, lui, demande une page à la fois.
--
-- `p_decalage` plutôt qu'un curseur : la page est contextualisée par une
-- annonce, l'ordre est stable, et les volumes en jeu ne justifient pas la
-- complexité d'un curseur — qui se paierait à chaque lecture.

create or replace function public.candidatures_de_mes_annonces(
  p_reference text default null,
  p_limite    integer default null,
  p_decalage  integer default 0
)
returns table (
  candidature_id  uuid,
  reference       text,
  statut          public.statut_candidature,
  message         text,
  deposee_le      timestamptz,
  repondue_le     timestamptz,
  candidat_nom    text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, a.reference, c.statut, c.message, c.created_at, c.repondue_le,
    cand.nom
  from public.candidatures c
  join public.annonces a on a.id = c.annonce_id
  left join public.candidats cand on cand.id = c.candidat_id
  where a.bailleur_id = (select auth.uid())
    and (p_reference is null or a.reference = p_reference)
  order by c.created_at desc
  limit nullif(greatest(coalesce(p_limite, 0), 0), 0)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

revoke all on function public.candidatures_de_mes_annonces(text, integer, integer) from public, anon;
grant execute on function public.candidatures_de_mes_annonces(text, integer, integer) to authenticated;

-- L'ancienne signature à un seul paramètre n'existe plus : PostgreSQL la
-- distinguerait de la nouvelle et les deux coexisteraient, dont une qui ne
-- serait plus jamais corrigée.
drop function if exists public.candidatures_de_mes_annonces(text);
