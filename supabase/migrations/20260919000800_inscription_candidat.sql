-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S8-B — un compte peut naître candidat
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Ce que cette migration change, et ce qu'elle préserve ─────────────────
--
-- Deux fonctions, pas une table : S8-A a déjà posé `candidats` et
-- `candidatures`.
--
--   1. `prive.gerer_nouvel_utilisateur` apprend un troisième cas. Sans
--      mention de rôle, elle crée un bailleur — c'est le comportement de
--      TOUTES les inscriptions existantes, et il ne bouge pas d'un iota.
--      `role = 'locataire'` sort sans rien créer, comme depuis le 13/09.
--      `role = 'candidat'` crée un profil candidat.
--
--   2. `public.mes_roles` rend un troisième booléen.
--
-- ─── Pourquoi le profil candidat naît dans le déclencheur ──────────────────
--
-- Parce qu'il n'y a pas d'autre moment. La confirmation d'email est active :
-- aucune session ne s'ouvre à l'inscription, et `enregistrer_profil_candidat`
-- (S8-A) exige une session. Le profil se créerait donc après la saisie du
-- code, dans un écran de plus — ou pas du tout, si la personne s'arrête là.
--
-- Les valeurs viennent des métadonnées d'inscription, comme pour un bailleur.
-- Elles ne décident d'aucune autorisation : ce sont un nom et un numéro que
-- leur propriétaire corrigera lui-même. Les mêmes valeurs de repli que pour
-- un bailleur évitent qu'un champ vide fasse échouer la création du compte.
--
-- ─── Le risque, et ce qui le contient ──────────────────────────────────────
--
-- Ce déclencheur est traversé par CHAQUE inscription. Une erreur ici casse la
-- création de compte pour tout le monde. La fonction est donc reprise en
-- entier — jamais réécrite de mémoire — et `banc:roles` vérifie les trois
-- chemins après coup.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prive.gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parrain_id uuid;
  v_code_parrain text;
  v_avatar text;
  v_role text;
begin
  v_role := nullif(trim(new.raw_user_meta_data ->> 'role'), '');

  -- ─── Sikaloc_Me : aucun profil bailleur ────────────────────────────────
  --
  -- Le rattachement de ce compte à ses lignes `locataires` se fait ailleurs,
  -- au moment où une invitation est acceptée : c'est l'invitation qui sait de
  -- quel bail il s'agit, pas l'inscription.
  if v_role = 'locataire' then
    return new;
  end if;

  -- ─── Sikaloc_Find : un profil candidat, et rien d'autre ────────────────
  --
  -- Ni code de parrainage, ni avatar, ni accès à l'espace de gestion. Le nom
  -- et le numéro sont ceux du formulaire de candidature ; les valeurs de repli
  -- ne servent qu'à ne jamais faire échouer une création de compte.
  if v_role = 'candidat' then
    insert into public.candidats (id, nom, telephone)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'nom'), ''), 'Candidat'),
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'telephone'), ''), 'Non renseigné')
    )
    on conflict (id) do nothing;

    return new;
  end if;

  -- ─── Le cas par défaut : un bailleur, comme avant ──────────────────────
  --
  -- L'absence de mention vaut « bailleur », ce qui préserve à l'identique
  -- toutes les inscriptions existantes.
  v_code_parrain := nullif(trim(new.raw_user_meta_data ->> 'code_parrain'), '');

  if v_code_parrain is not null then
    select b.id
      into v_parrain_id
      from public.bailleurs b
     where b.code_parrainage = upper(v_code_parrain);
  end if;

  v_avatar := nullif(trim(new.raw_user_meta_data ->> 'avatar'), '');
  if v_avatar is not null and v_avatar !~ '^[0-9]{1,3}(-[0-9]{1,3}){4}$' then
    v_avatar := null;
  end if;

  insert into public.bailleurs (
    id, nom, telephone, email, code_parrainage, parrain_id, nb_logements_declare, avatar,
    avatar_temporaire_depuis
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nom'), ''), 'Bailleur'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'telephone'), ''), 'Non renseigné'),
    new.email,
    prive.generer_code_parrainage(),
    v_parrain_id,
    nullif(new.raw_user_meta_data ->> 'nb_logements', '')::smallint,
    v_avatar,
    -- Jour 0 de la période d'avatar temporaire.
    now()
  );

  return new;
end;
$$;

-- ─── « Qui suis-je ? », troisième réponse ──────────────────────────────────
--
-- Le type de retour change : PostgreSQL impose de supprimer puis recréer.
-- Les droits sont reposés à l'identique.
--
-- Un compte peut porter les trois profils à la fois — quelqu'un qui loue un
-- logement, en met un autre en location, et cherche à déménager. Rien dans le
-- modèle ne l'en empêche, et rien ici ne le décide à sa place.

drop function if exists public.mes_roles();

create or replace function public.mes_roles()
returns table (est_bailleur boolean, est_locataire boolean, est_candidat boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.bailleurs  b where b.id        = (select auth.uid())),
    exists (select 1 from public.locataires l where l.compte_id = (select auth.uid())),
    exists (select 1 from public.candidats  c where c.id        = (select auth.uid()));
$$;

comment on function public.mes_roles() is
  'Les rôles de l''appelant : bailleur, locataire, candidat — ou plusieurs. Ne rend que des booléens le concernant.';

revoke all on function public.mes_roles() from public, anon;
grant execute on function public.mes_roles() to authenticated;
