-- =============================================================================
-- Sikaloc — La période d'avatar s'ouvre dès l'inscription
--
-- 20260912000300 avait ouvert la période pour les comptes EXISTANTS, par un
-- `update` unique. Rien ne l'ouvrait pour ceux créés ensuite : le déclencheur
-- d'inscription ne connaissait pas la colonne.
--
-- Conséquence, prise par `npm run banc:identite` : un compte neuf n'avait pas
-- de date de début. Le décompte ne partait donc jamais — l'interface annonçait
-- « il vous reste 5 jours » indéfiniment, et le rappel n'atteignait jamais son
-- palier insistant.
--
-- La fonction est reprise telle qu'elle existe depuis 20260819000100, à une
-- ligne près. Elle est recopiée en entier plutôt que modifiée : `create or
-- replace` remplace le corps complet, et écrire de mémoire une fonction qui
-- crée les comptes est le meilleur moyen d'en perdre un morceau.
-- =============================================================================

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
