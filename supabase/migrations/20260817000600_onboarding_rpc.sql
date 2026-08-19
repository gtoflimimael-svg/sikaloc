-- =============================================================================
-- Sikaloc — Onboarding transactionnel
--
-- L'étape 3 de l'onboarding (§6.1.2) crée « implicitement » le logement, le
-- locataire et le bail. Trois INSERT séparés depuis l'application laisseraient
-- un locataire orphelin si la création du bail échouait. Une fonction les
-- regroupe dans une seule transaction.
--
-- SECURITY INVOKER : la fonction s'exécute avec les droits de l'appelant, donc
-- les policies RLS s'appliquent normalement. Aucune élévation de privilège.
-- =============================================================================

create or replace function public.creer_premier_bail(
  p_locataire_nom       text,
  p_locataire_telephone text,
  p_logement_adresse    text,
  p_logement_ville      text,
  p_logement_type       public.type_logement,
  p_loyer_mensuel       numeric,
  p_jour_echeance       smallint,
  p_date_debut          date
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bailleur  uuid := (select auth.uid());
  v_locataire uuid;
  v_logement  uuid;
  v_bail      uuid;
begin
  if v_bailleur is null then
    raise exception 'Authentification requise.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.locataires (
    bailleur_id, nom, telephone, consentement_donnees, date_consentement
  )
  values (v_bailleur, p_locataire_nom, p_locataire_telephone, true, current_date)
  returning id into v_locataire;

  insert into public.logements (bailleur_id, adresse, ville, type, pays)
  values (v_bailleur, p_logement_adresse, p_logement_ville, p_logement_type, 'Bénin')
  returning id into v_logement;

  insert into public.baux (
    bailleur_id, logement_id, locataire_id, loyer_mensuel, date_debut, jour_echeance
  )
  values (
    v_bailleur, v_logement, v_locataire, p_loyer_mensuel, p_date_debut, p_jour_echeance
  )
  returning id into v_bail;

  update public.bailleurs
     set onboarding_termine = true
   where id = v_bailleur;

  return v_bail;
end;
$$;

-- Postgres accorde EXECUTE à PUBLIC par défaut : on referme puis on ouvre au
-- seul rôle authenticated.
revoke all on function public.creer_premier_bail(
  text, text, text, text, public.type_logement, numeric, smallint, date
) from public, anon;

grant execute on function public.creer_premier_bail(
  text, text, text, text, public.type_logement, numeric, smallint, date
) to authenticated;
