-- ═══════════════════════════════════════════════════════════════════════════
-- Le socle de l'écosystème : un locataire peut avoir un compte
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Ce que Sikaloc sait faire aujourd'hui, et ce qu'il ne sait pas ────────
--
-- Un locataire, dans Sikaloc, est une ligne dans la table d'un bailleur. Un
-- nom, un numéro, un consentement. Il n'a pas de compte, ne se connecte pas,
-- ne voit rien. Toute la base est construite là-dessus : sur vingt-deux
-- politiques d'accès, vingt disent `auth.uid() = bailleur_id`.
--
-- Cette migration ne renverse pas ce modèle. Elle y ajoute une seule chose :
-- la possibilité qu'une ligne `locataires` désigne aussi un compte.
--
-- ─── Le piège qu'elle referme d'abord ──────────────────────────────────────
--
-- `prive.gerer_nouvel_utilisateur` crée une ligne `bailleurs` à CHAQUE
-- inscription, sans condition. En l'état, le premier locataire qui se serait
-- inscrit serait devenu un bailleur — avec un code de parrainage, une période
-- d'avatar, et l'accès à l'espace de gestion.
--
-- Le déclencheur apprend donc à lire un rôle. Par défaut, et en l'absence de
-- toute mention, il continue de créer un bailleur : c'est exactement son
-- comportement actuel, et aucune inscription existante ne change de sens.
--
-- ─── Multi-rôle, sans limitation artificielle ──────────────────────────────
--
-- Rien n'interdit qu'un compte porte à la fois une ligne `bailleurs` et des
-- lignes `locataires`. C'est le cas réel de quelqu'un qui loue un logement et
-- en possède un autre. `compte_id` n'est donc pas unique : la même personne
-- peut être locataire chez deux bailleurs différents, ce qui fait deux lignes
-- `locataires` pointant vers le même compte. Les rendre uniques aurait
-- interdit une situation parfaitement ordinaire.

-- ── Le lien entre une ligne locataire et un compte ─────────────────────────
alter table public.locataires
  add column if not exists compte_id uuid references auth.users(id) on delete set null,
  add column if not exists compte_lie_le timestamptz;

comment on column public.locataires.compte_id is
  'Compte Sikaloc_Me associé à ce locataire. NULL = le locataire n''a pas (encore) de compte, ce qui reste le cas courant. Non unique : une même personne peut louer chez plusieurs bailleurs.';
comment on column public.locataires.compte_lie_le is
  'Moment de l''association. Trace : rattacher une personne à un bail est un acte qui engage.';

-- Retrouver « tous les locataires de ce compte » est la requête de base de
-- Sikaloc_Me : elle part du compte, pas du bailleur.
create index if not exists idx_locataires_compte
  on public.locataires (compte_id)
  where compte_id is not null;

-- Le lien ne se pose pas deux fois sur la même ligne, et ne se renseigne pas
-- sans date : les deux colonnes vont ensemble ou pas du tout.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locataires_compte_coherent') then
    alter table public.locataires
      add constraint locataires_compte_coherent check (
        (compte_id is null and compte_lie_le is null)
        or (compte_id is not null and compte_lie_le is not null)
      );
  end if;
end
$$;

-- ── L'inscription apprend à distinguer les deux espaces ────────────────────
--
-- Une seule ligne change par rapport à la version précédente : la sortie
-- anticipée quand les métadonnées annoncent un locataire. Tout le reste est
-- repris à l'identique — parrainage, avatar, valeurs de repli, période
-- d'avatar temporaire — parce qu'en réécrire une partie de mémoire est le
-- meilleur moyen d'en perdre un morceau.
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
begin
  -- ─── Sikaloc_Me : aucun profil bailleur ────────────────────────────────
  --
  -- Le rattachement de ce compte à ses lignes `locataires` se fait ailleurs,
  -- au moment où une invitation est acceptée : c'est l'invitation qui sait de
  -- quel bail il s'agit, pas l'inscription.
  --
  -- L'absence de mention vaut « bailleur », ce qui préserve à l'identique
  -- toutes les inscriptions existantes.
  if nullif(trim(new.raw_user_meta_data ->> 'role'), '') = 'locataire' then
    return new;
  end if;

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

-- ── « Qui suis-je ? » ──────────────────────────────────────────────────────
--
-- Un locataire ne peut pas répondre lui-même à cette question : les politiques
-- de `locataires` ne rendent que les lignes du bailleur propriétaire, et un
-- locataire n'est le bailleur de personne. Il ne verrait donc jamais sa propre
-- ligne.
--
-- SECURITY DEFINER pour cette seule raison. La fonction ne rend que deux
-- booléens sur l'appelant lui-même : elle ne donne accès à aucune donnée, et
-- ne dit rien de qui que ce soit d'autre.
create or replace function public.mes_roles()
returns table (est_bailleur boolean, est_locataire boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (select 1 from public.bailleurs  b where b.id        = (select auth.uid())),
    exists (select 1 from public.locataires l where l.compte_id = (select auth.uid()));
$$;

comment on function public.mes_roles() is
  'Les rôles de l''appelant : bailleur, locataire, ou les deux. Ne rend que des booléens le concernant.';

revoke all on function public.mes_roles() from public, anon;
grant execute on function public.mes_roles() to authenticated;

-- ── Les données existantes ────────────────────────────────────────────────
--
-- Aucune ligne n'est touchée. `compte_id` reste NULL partout, ce qui est la
-- vérité : aucun des locataires enregistrés n'a de compte, et aucun ne doit en
-- recevoir un sans y avoir été invité. Créer des comptes en masse produirait
-- des accès que personne n'a demandés, sur des numéros que personne n'a
-- vérifiés.
