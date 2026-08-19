-- =============================================================================
-- Sikaloc — Fonctions et déclencheurs
-- Toutes les fonctions SECURITY DEFINER vivent dans le schéma `prive`, qui
-- n'est pas exposé au Data API : sans cela, Postgres accorde EXECUTE à PUBLIC
-- et chaque fonction deviendrait un endpoint appelable par `anon`.
-- =============================================================================

-- ─── Génération d'un code de parrainage lisible ─────────────────────────────
-- Alphabet sans caractères ambigus (ni O/0, ni I/1) : le code se dicte au
-- téléphone et se recopie depuis WhatsApp sans erreur.

create or replace function prive.generer_code_parrainage()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := 'SIKA-';
    for i in 1 .. 5 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.bailleurs b where b.code_parrainage = code
    );
  end loop;
  return code;
end;
$$;

-- ─── Création du profil bailleur à l'inscription ────────────────────────────
-- SECURITY DEFINER est nécessaire : le trigger s'exécute pendant l'insertion
-- dans auth.users, avant qu'une session applicative n'existe.
--
-- Sur l'usage de raw_user_meta_data : ces champs sont modifiables par
-- l'utilisateur, ils ne servent donc QUE de données de profil (nom, téléphone).
-- Aucune décision d'autorisation ne s'y appuie — en particulier `plan` n'est
-- jamais lu depuis les métadonnées, il reste à 'Gratuit' et n'est modifié que
-- par le webhook de paiement côté serveur.

create or replace function prive.gerer_nouvel_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parrain_id uuid;
  v_code_parrain text;
begin
  v_code_parrain := nullif(trim(new.raw_user_meta_data ->> 'code_parrain'), '');

  if v_code_parrain is not null then
    select b.id
      into v_parrain_id
      from public.bailleurs b
     where b.code_parrainage = upper(v_code_parrain);
  end if;

  insert into public.bailleurs (
    id, nom, telephone, email, code_parrainage, parrain_id, nb_logements_declare
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nom'), ''), 'Bailleur'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'telephone'), ''), 'Non renseigné'),
    new.email,
    prive.generer_code_parrainage(),
    v_parrain_id,
    nullif(new.raw_user_meta_data ->> 'nb_logements', '')::smallint
  );

  return new;
end;
$$;

create trigger creer_profil_bailleur
  after insert on auth.users
  for each row
  execute function prive.gerer_nouvel_utilisateur();

-- ─── Horodatage de mise à jour ──────────────────────────────────────────────

create or replace function prive.toucher_mis_a_jour_le()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.mis_a_jour_le := now();
  return new;
end;
$$;

create trigger toucher_abonnements_transactions
  before update on public.abonnements_transactions
  for each row
  execute function prive.toucher_mis_a_jour_le();

-- ─── Cohérence du bailleur propriétaire ─────────────────────────────────────
-- Empêche de rattacher un bail au logement d'un autre bailleur : sans ce
-- contrôle, les RLS laisseraient passer un `logement_id` volé puisque la
-- policy ne valide que la colonne `bailleur_id` de la ligne insérée.

create or replace function prive.verifier_coherence_bail()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.logements l
     where l.id = new.logement_id and l.bailleur_id = new.bailleur_id
  ) then
    raise exception 'Le logement sélectionné n''appartient pas à ce bailleur.'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.locataires t
     where t.id = new.locataire_id and t.bailleur_id = new.bailleur_id
  ) then
    raise exception 'Le locataire sélectionné n''appartient pas à ce bailleur.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger verifier_coherence_bail
  before insert or update on public.baux
  for each row
  execute function prive.verifier_coherence_bail();

create or replace function prive.verifier_coherence_paiement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.baux b
     where b.id = new.bail_id and b.bailleur_id = new.bailleur_id
  ) then
    raise exception 'Le bail sélectionné n''appartient pas à ce bailleur.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger verifier_coherence_paiement
  before insert or update on public.paiements
  for each row
  execute function prive.verifier_coherence_paiement();

-- ─── Fenêtre de correction de 5 minutes (§6.1.7) ────────────────────────────
-- Passé ce délai, un paiement validé est figé : c'est la garantie qui rend la
-- quittance opposable. Le contrôle vit en base et non dans l'application, pour
-- qu'aucun chemin d'écriture ne puisse le contourner.

create or replace function prive.proteger_paiement_fige()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.statut = 'Validé'
     and old.valide_le is not null
     and old.valide_le < now() - interval '5 minutes'
  then
    raise exception
      'Ce paiement est figé : la fenêtre de correction de 5 minutes est écoulée.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger proteger_paiement_fige_update
  before update on public.paiements
  for each row
  execute function prive.proteger_paiement_fige();

create or replace function prive.proteger_suppression_paiement_fige()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.statut = 'Validé'
     and old.valide_le is not null
     and old.valide_le < now() - interval '5 minutes'
  then
    raise exception
      'Ce paiement est figé : il ne peut plus être supprimé.'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

create trigger proteger_paiement_fige_delete
  before delete on public.paiements
  for each row
  execute function prive.proteger_suppression_paiement_fige();
