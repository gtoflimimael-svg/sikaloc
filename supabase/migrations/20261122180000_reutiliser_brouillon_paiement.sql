-- Un seul brouillon de paiement en cours par bail, période et nature (FN-06).
--
-- Chaque saisie abandonnée ou interrompue avant confirmation laissait un
-- brouillon. Trois brouillons identiques (même bail, même mois) se sont
-- accumulés en recette : historique confus, risque de double validation.
--
-- Désormais, une nouvelle saisie pour le même bail, la même période et la
-- même nature REPREND le brouillon existant (montant, date et mode mis à
-- jour) au lieu d'en créer un autre. Un versement confirmé n'est plus un
-- brouillon : deux versements partiels successifs, chacun confirmé, restent
-- deux paiements distincts.
--
-- Corps repris à l'identique de la version en production (contrôles,
-- verrou, propriété, calcul du partiel), seule l'étape de reprise est ajoutée.

create or replace function public.creer_paiement_brouillon(
  p_bail_id uuid,
  p_date_paiement date,
  p_montant numeric,
  p_periode_debut date,
  p_mode_paiement public.mode_paiement,
  p_type_paiement public.type_paiement default 'Loyer'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_acteur uuid := auth.uid();
  v_bail public.baux;
  v_cumul numeric;
  v_loyer numeric;
  v_id uuid;
  v_partiel boolean;
begin
  if v_acteur is null then raise exception 'Authentification requise.' using errcode = '42501'; end if;
  if p_date_paiement is null or p_montant is null or p_montant <= 0
     or p_periode_debut is null or extract(day from p_periode_debut) <> 1
     or p_mode_paiement is null or p_type_paiement is null then
    raise exception 'Données de paiement invalides.' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(72150302);
  if not exists (
    select 1 from public.bailleurs b where b.id = v_acteur
      and b.statut_abonnement in ('actif'::public.statut_abonnement, 'grace'::public.statut_abonnement)
  ) then raise exception 'Écriture non autorisée.' using errcode = '42501'; end if;

  select * into v_bail from public.baux b
   where b.id = p_bail_id and b.bailleur_id = v_acteur for share;
  if not found or not exists (
    select 1 from public.logements l join public.locataires t on t.id = v_bail.locataire_id
     where l.id = v_bail.logement_id and l.bailleur_id = v_acteur and t.bailleur_id = v_acteur
  ) then raise exception 'Bail introuvable ou non autorisé.' using errcode = '42501'; end if;

  v_loyer := prive.montant_exigible_bail_pour_periode(v_bail.id, p_periode_debut);
  select coalesce(sum(p.montant), 0) into v_cumul
    from public.paiements p
   where p.bail_id = p_bail_id and p.bailleur_id = v_acteur
     and p.periode_debut = p_periode_debut
     and p.type_paiement = 'Loyer'::public.type_paiement
     and p.statut = 'Validé'::public.statut_paiement;

  v_partiel := case when p_type_paiement <> 'Loyer'::public.type_paiement then false
    when v_loyer is null then null else v_cumul + p_montant < v_loyer end;

  -- Reprise du brouillon en cours, s'il existe (FN-06).
  select p.id into v_id
    from public.paiements p
   where p.bail_id = p_bail_id and p.bailleur_id = v_acteur
     and p.periode_debut = p_periode_debut
     and p.type_paiement = p_type_paiement
     and p.statut = 'Brouillon'::public.statut_paiement
     and p.historique = false
   order by p.created_at desc
   limit 1
   for update;

  if found then
    update public.paiements set
      date_paiement = p_date_paiement,
      montant = p_montant,
      mode_paiement = p_mode_paiement,
      est_partiel = v_partiel
     where id = v_id and bailleur_id = v_acteur
       and statut = 'Brouillon'::public.statut_paiement;
    return v_id;
  end if;

  insert into public.paiements (
    bailleur_id, bail_id, date_paiement, montant, periode_debut, periode_fin,
    mode_paiement, type_paiement, est_partiel, statut, valide_le, historique
  ) values (
    v_acteur, p_bail_id, p_date_paiement, p_montant, p_periode_debut,
    (p_periode_debut + interval '1 month - 1 day')::date,
    p_mode_paiement, p_type_paiement, v_partiel,
    'Brouillon'::public.statut_paiement, null, false
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.creer_paiement_brouillon(uuid, date, numeric, date, public.mode_paiement, public.type_paiement)
  from public, anon, service_role;
grant execute on function public.creer_paiement_brouillon(uuid, date, numeric, date, public.mode_paiement, public.type_paiement)
  to authenticated;
