-- Aperçu du document avant validation d'un paiement (FN-05).
--
-- L'écran de confirmation lisait `v_echeances`, qui ne génère les périodes que
-- jusqu'au mois courant. Pour un loyer payé d'avance, l'aperçu ne trouvait
-- aucune échéance et annonçait un reçu, alors que `preparer_emission_quittance`
-- calcule le montant exigible avec `prive.montant_exigible_bail_pour_periode`
-- et émet une quittance. Cette fonction expose à l'aperçu exactement ces deux
-- grandeurs, sans rien écrire ; la décision d'autorité reste celle de la RPC
-- d'émission.

create or replace function public.apercu_echeance_paiement(p_paiement_id uuid)
returns table (montant_exigible numeric, cumul_valide_avant numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_acteur uuid := auth.uid();
  v_paiement public.paiements;
begin
  if v_acteur is null then
    raise exception 'Authentification requise.' using errcode = '42501';
  end if;

  select p.* into v_paiement
    from public.paiements p
    join public.baux b on b.id = p.bail_id and b.bailleur_id = v_acteur
   where p.id = p_paiement_id
     and p.bailleur_id = v_acteur;
  if not found then
    raise exception 'Paiement introuvable ou non autorisé.' using errcode = '42501';
  end if;

  if v_paiement.type_paiement <> 'Loyer'::public.type_paiement then
    return query select null::numeric, null::numeric;
    return;
  end if;

  return query
  select
    prive.montant_exigible_bail_pour_periode(v_paiement.bail_id, v_paiement.periode_debut),
    coalesce((
      select sum(x.montant)
        from public.paiements x
       where x.bail_id = v_paiement.bail_id
         and x.bailleur_id = v_acteur
         and x.id <> v_paiement.id
         and x.periode_debut = v_paiement.periode_debut
         and x.type_paiement = 'Loyer'::public.type_paiement
         and x.statut = 'Validé'::public.statut_paiement
    ), 0);
end;
$$;

comment on function public.apercu_echeance_paiement(uuid) is
  'Montant exigible et cumul validé hors ce paiement, calculés comme à l’émission. Lecture seule, réservée au bailleur du paiement.';

revoke all on function public.apercu_echeance_paiement(uuid) from public, anon, service_role;
grant execute on function public.apercu_echeance_paiement(uuid) to authenticated;
