-- Les documents émis avant les snapshots financiers n'ont pas de
-- donnees_financieres. Leur bilan doit être reconstitué à la date du document,
-- sans inclure les versements validés ultérieurement.

create or replace function prive.finances_paiement_locatif_a_date(
  p public.paiements,
  p_loyer numeric,
  p_date_reference timestamptz
) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare f jsonb; cumul numeric; versements jsonb;
begin
  if p.id is null or p_date_reference is null then return null; end if;

  -- Les snapshots récents restent la source d'autorité s'ils correspondent
  -- toujours au paiement et aux versements dont ils gardent l'empreinte.
  select e.finances into f from prive.finances_emission e
  where e.paiement_id=p.id
    and e.empreinte_paiement=prive.empreinte_paiement_locatif(p)
    and not exists (
      select 1 from jsonb_array_elements(e.finances->'versements') v
      left join public.paiements x on x.id=(v->>'id')::uuid
      where x.id is null
        or encode(prive.empreinte_paiement_locatif(x),'hex')<>v->>'empreinte'
    );
  if f is not null then return f; end if;

  -- valide_le est obligatoire pour tout paiement Validé et devient immuable
  -- après la fenêtre de correction. Il borne donc le bilan historique.
  select coalesce(sum(x.montant),0),
    coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'empreinte',encode(prive.empreinte_paiement_locatif(x),'hex')
    ) order by x.id),'[]'::jsonb)
  into cumul,versements
  from public.paiements x
  where x.bail_id=p.bail_id
    and x.bailleur_id=p.bailleur_id
    and x.periode_debut=p.periode_debut
    and x.type_paiement='Loyer'
    and x.statut='Validé'
    and x.valide_le<=p_date_reference;

  return jsonb_build_object(
    'empreinte_paiement',encode(prive.empreinte_paiement_locatif(p),'hex'),
    'montant',p.montant,'cumul_loyer',cumul,'loyer_mensuel',p_loyer,
    'solde_restant',greatest(0,p_loyer-cumul),
    'est_partiel',p.type_paiement='Loyer' and cumul<p_loyer,
    'periode_debut',p.periode_debut,'periode_fin',p.periode_fin,
    'date_paiement',p.date_paiement,'mode_paiement',p.mode_paiement,
    'type_paiement',p.type_paiement,'versements',versements
  );
end $$;
revoke all on function prive.finances_paiement_locatif_a_date(public.paiements,numeric,timestamptz)
  from public,anon,authenticated,service_role;

-- Conserve la signature utilisée pendant la préparation d'une nouvelle
-- émission : son instant de référence est la transaction SQL courante.
create or replace function prive.finances_paiement_locatif(p public.paiements,loyer numeric)
returns jsonb language sql stable security invoker set search_path='' as $$
  select prive.finances_paiement_locatif_a_date(p,loyer,now());
$$;
revoke all on function prive.finances_paiement_locatif(public.paiements,numeric)
  from public,anon,authenticated,service_role;

-- Pour un document déjà publié sans snapshot, reconstruit l'état à sa date de
-- génération. Un document non publié continue d'utiliser l'état courant.
create or replace function public.lire_quittance_autorisee(p_acteur uuid, p_quittance uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('quittance',to_jsonb(q),'signee',exists(
      select 1 from public.signatures_apposees s where s.quittance_id=q.id),
    'contexte',jsonb_build_object('paiement',to_jsonb(p),'bail',to_jsonb(b),
      'logement',to_jsonb(l),'locataire',to_jsonb(t),'bailleur',to_jsonb(a),
      'finances',coalesce(q.donnees_financieres,
        case when q.pdf_chemin is not null
          then prive.finances_paiement_locatif_a_date(p,b.loyer_mensuel,q.date_generation)
          else prive.finances_paiement_locatif(p,b.loyer_mensuel)
        end)))
  from public.quittances q
  join public.paiements p on p.id=q.paiement_id and p.bailleur_id=q.bailleur_id
  join public.baux b on b.id=p.bail_id and b.bailleur_id=p.bailleur_id
  join public.logements l on l.id=b.logement_id and l.bailleur_id=p.bailleur_id
  join public.locataires t on t.id=b.locataire_id and t.bailleur_id=p.bailleur_id
  join public.bailleurs a on a.id=p.bailleur_id
  where q.id=p_quittance and p.statut='Validé'
    and ((q.pdf_chemin is null and q.hash_sha256 is null)
      or (q.donnees_financieres->>'empreinte_paiement')=encode(prive.empreinte_paiement_locatif(p),'hex')
      or (q.donnees_financieres is null and not exists(
        select 1 from prive.finances_emission f where f.paiement_id=p.id)))
    and (p_acteur=a.id or p_acteur=t.compte_id);
$$;
revoke all on function public.lire_quittance_autorisee(uuid,uuid) from public,anon,authenticated;
grant execute on function public.lire_quittance_autorisee(uuid,uuid) to service_role;
