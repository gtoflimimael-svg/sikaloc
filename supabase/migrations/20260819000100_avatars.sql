-- =============================================================================
-- Sikaloc — Avatars Open Peeps
--
-- Un avatar est une combinaison d'index, encodée en texte :
-- « tenue-coiffure-visage-pilosite-accessoire », par exemple « 3-7-4-0-2 ».
--
-- La colonne est NULLABLE et le reste : tant qu'elle vaut NULL, l'application
-- dérive un avatar stable de l'identifiant de la ligne (fonction `depuisIdentifiant`
-- côté TypeScript). Personne n'a donc besoin d'être rempli rétroactivement, et
-- une ligne jamais personnalisée garde malgré tout un visage constant.
--
-- La contrainte de format est volontairement stricte : cette valeur finit dans
-- un segment d'URL (`/avatar/<config>.svg`). On n'y accepte que des chiffres et
-- des tirets, ce qui la rend inapte à transporter autre chose.
-- =============================================================================

alter table public.bailleurs
  add column if not exists avatar text;

alter table public.locataires
  add column if not exists avatar text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bailleurs_avatar_format'
  ) then
    alter table public.bailleurs
      add constraint bailleurs_avatar_format
      check (avatar is null or avatar ~ '^[0-9]{1,3}(-[0-9]{1,3}){4}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'locataires_avatar_format'
  ) then
    alter table public.locataires
      add constraint locataires_avatar_format
      check (avatar is null or avatar ~ '^[0-9]{1,3}(-[0-9]{1,3}){4}$');
  end if;
end
$$;

comment on column public.bailleurs.avatar is
  'Avatar Open Peeps : « tenue-coiffure-visage-pilosite-accessoire ». NULL = dérivé de l''id.';
comment on column public.locataires.avatar is
  'Avatar Open Peeps : « tenue-coiffure-visage-pilosite-accessoire ». NULL = dérivé de l''id.';

-- ─── Reprise de l'avatar choisi à l'inscription ──────────────────────────────
-- Le formulaire d'inscription pose `avatar` dans les métadonnées ; le trigger
-- de création de profil le recopie. Une valeur absente ou mal formée est
-- ignorée : la ligne retombe alors sur l'avatar dérivé.

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
    id, nom, telephone, email, code_parrainage, parrain_id, nb_logements_declare, avatar
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nom'), ''), 'Bailleur'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'telephone'), ''), 'Non renseigné'),
    new.email,
    prive.generer_code_parrainage(),
    v_parrain_id,
    nullif(new.raw_user_meta_data ->> 'nb_logements', '')::smallint,
    v_avatar
  );

  return new;
end;
$$;
