-- ═══════════════════════════════════════════════════════════════════════════
-- Une seule forme de numéro de téléphone en base
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Ce qu'on trouvait avant cette migration ───────────────────────────────
--
-- Quatre écritures différentes du même genre de numéro, saisies au fil des
-- mois dans un champ texte libre :
--
--     +2290190459821        indicatif collé, dix chiffres
--     +22990459821          indicatif collé, huit chiffres (avant 2024)
--     +229 01 92 73 33 67   indicatif et espaces de présentation
--     0192615924            aucun indicatif
--
-- Toutes désignent des abonnés joignables. Mais chaque comparaison, chaque
-- recherche, chaque appel d'API devait d'abord deviner la forme reçue — et un
-- oubli suffisait pour qu'un lien WhatsApp ne mène nulle part.
--
-- ─── La forme retenue ──────────────────────────────────────────────────────
--
--     +2290190459821
--
-- L'indicatif, puis les dix chiffres, sans séparateur. Les espaces sont de la
-- présentation : `formaterTelephone()` les remet à l'affichage, la base ne les
-- stocke plus.
--
-- ─── Les huit chiffres d'avant la réforme ──────────────────────────────────
--
-- Le Bénin est passé de huit à dix chiffres en préfixant les numéros existants
-- de « 01 ». Convertir « 90459821 » en « 0190459821 » n'invente donc rien :
-- c'est le même abonné, écrit selon le plan de numérotation en vigueur. Les
-- quatre numéros concernés sont convertis, aucun n'est supprimé.
--
-- ─── Réparer plutôt que refuser ────────────────────────────────────────────
--
-- La garantie tient à un déclencheur BEFORE, pas à une contrainte CHECK.
--
-- Une contrainte stricte aurait cassé la création de compte : le déclencheur
-- `prive.gerer_nouvel_utilisateur` retombe sur « Non renseigné » quand les
-- métadonnées d'inscription n'ont pas de téléphone, et une insertion refusée
-- dans `bailleurs` annule l'inscription entière dans `auth.users`. Personne
-- n'aurait plus pu s'inscrire.
--
-- Le déclencheur réécrit donc la valeur au lieu de la rejeter. Quelle que soit
-- la voie d'écriture — formulaire, action serveur, script, console Supabase —
-- ce qui est stocké est canonique. Ce qu'il ne sait pas lire, il le laisse
-- passer intact : c'est à la validation applicative (`validerTelephone`) de
-- refuser une saisie, avec un message que le bailleur comprend, et non à une
-- erreur Postgres.

-- ── La normalisation, une seule fois, en SQL ───────────────────────────────
--
-- Reproduit `chiffresNationaux()` + `normaliserTelephone()` de
-- `src/lib/telephone.ts`. Deux implémentations, une seule règle : toute
-- modification de l'une doit être portée dans l'autre.
--
-- La boucle retire l'indicatif même répété. « +229+2290190459821 » arrive
-- vraiment, quand on colle un numéro complet dans un champ déjà préfixé.
create or replace function prive.telephone_canonique(saisie text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_chiffres text;
  v_precedent text;
begin
  if saisie is null then
    return null;
  end if;

  v_chiffres := regexp_replace(saisie, '\D', '', 'g');
  if v_chiffres = '' then
    return null;
  end if;

  loop
    v_precedent := v_chiffres;

    if left(v_chiffres, 5) = '00229' then
      v_chiffres := substr(v_chiffres, 6);
    elsif left(v_chiffres, 3) = '229' and length(v_chiffres) > 8 then
      v_chiffres := substr(v_chiffres, 4);
    end if;

    exit when v_chiffres = v_precedent;
  end loop;

  -- Réforme béninoise de 2024 : les numéros à huit chiffres ont été préfixés
  -- de « 01 ».
  if length(v_chiffres) = 8 then
    v_chiffres := '01' || v_chiffres;
  end if;

  -- Ni huit ni dix chiffres : ce n'est pas un numéro béninois. On ne rend rien
  -- plutôt qu'un numéro inventé.
  if length(v_chiffres) <> 10 then
    return null;
  end if;

  return '+229' || v_chiffres;
end;
$$;

comment on function prive.telephone_canonique(text) is
  'Forme canonique +229XXXXXXXXXX, ou NULL si la saisie n''est pas un numéro béninois. Miroir SQL de normaliserTelephone() (src/lib/telephone.ts).';

-- ── Conversion des numéros déjà enregistrés ────────────────────────────────
--
-- Rien n'est écrasé à l'aveugle : seules les lignes dont la forme canonique
-- diffère de la valeur actuelle sont touchées. Ce que la fonction ne sait pas
-- lire reste tel quel — mieux vaut un numéro mal écrit qu'un numéro perdu.
update public.bailleurs
   set telephone = prive.telephone_canonique(telephone)
 where prive.telephone_canonique(telephone) is not null
   and prive.telephone_canonique(telephone) <> telephone;

update public.locataires
   set telephone = prive.telephone_canonique(telephone)
 where prive.telephone_canonique(telephone) is not null
   and prive.telephone_canonique(telephone) <> telephone;

-- ── Et pour tout ce qui sera écrit ensuite ─────────────────────────────────
--
-- SECURITY DEFINER pour une seule raison : le rôle `authenticated` n'a pas
-- USAGE sur le schéma `prive`, il ne pourrait donc pas appeler
-- `telephone_canonique`. La fonction ne lit ni n'écrit aucune table et ne
-- touche qu'à NEW : elle n'ouvre aucun privilège.
create or replace function prive.canoniser_telephone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_canonique text;
begin
  v_canonique := prive.telephone_canonique(new.telephone);

  if v_canonique is not null then
    new.telephone := v_canonique;
  end if;

  return new;
end;
$$;

comment on function prive.canoniser_telephone() is
  'Déclencheur BEFORE : réécrit telephone sous sa forme canonique. Laisse intact ce qu''il ne sait pas lire.';

-- `update of telephone` : sur une mise à jour qui ne touche pas au numéro, le
-- déclencheur ne s'exécute pas du tout.
drop trigger if exists canoniser_telephone on public.bailleurs;
create trigger canoniser_telephone
  before insert or update of telephone on public.bailleurs
  for each row
  execute function prive.canoniser_telephone();

drop trigger if exists canoniser_telephone on public.locataires;
create trigger canoniser_telephone
  before insert or update of telephone on public.locataires
  for each row
  execute function prive.canoniser_telephone();
