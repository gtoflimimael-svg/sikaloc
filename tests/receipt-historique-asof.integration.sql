-- Sikaloc-Test seulement. Le bloc EXCEPTION annule toute fixture; aucun service externe/Storage.
do $test$
declare
  u uuid := gen_random_uuid(); l uuid; t uuid; b uuid; p1 uuid:=gen_random_uuid(); p2 uuid:=gen_random_uuid(); q uuid:=gen_random_uuid();
  doc_at timestamptz:=clock_timestamp()-interval '5 minutes'; pay public.paiements; current_fin jsonb; receipt jsonb;
begin
  begin
    insert into auth.users(id,email,raw_user_meta_data) values(u,'fixture-'||replace(u::text,'-','')||'@example.invalid',jsonb_build_object('nom','Fixture historique','telephone','+22997000001'));
    insert into public.logements(bailleur_id,adresse,type,ville) values(u,'Fixture temporaire','Appartement','Cotonou') returning id into l;
    insert into public.locataires(bailleur_id,nom,telephone,consentement_donnees,date_consentement) values(u,'Locataire fixture','+22997000002',true,current_date) returning id into t;
    insert into public.baux(bailleur_id,logement_id,locataire_id,loyer_mensuel,date_debut,jour_echeance) values(u,l,t,100000,current_date-interval '2 months',5) returning id into b;
    insert into public.paiements(id,bailleur_id,bail_id,date_paiement,montant,periode_debut,periode_fin,mode_paiement,statut,valide_le) values
      (p1,u,b,current_date,30000,date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month - 1 day')::date,'Espèces','Validé',doc_at-interval '1 minute'),
      (p2,u,b,current_date,20000,date_trunc('month',current_date)::date,(date_trunc('month',current_date)+interval '1 month - 1 day')::date,'Espèces','Validé',doc_at+interval '1 minute');
    insert into public.quittances(id,bailleur_id,paiement_id,bail_id,numero_document,type,date_generation,pdf_chemin)
      values(q,u,p1,b,'FIXTURE-'||replace(q::text,'-',''),'Reçu',doc_at,'quittances/'||u::text||'/fixture.pdf');
    select x into pay from public.paiements x where x.id=p1;
    current_fin:=prive.finances_paiement_locatif(pay,100000);
    receipt:=public.lire_quittance_autorisee(u,q)->'contexte'->'finances';
    if (current_fin->>'cumul_loyer')::numeric is distinct from 50000 or (current_fin->>'solde_restant')::numeric is distinct from 50000 then raise exception 'Le contrôle courant doit compter les deux versements.'; end if;
    if (receipt->>'cumul_loyer')::numeric is distinct from 30000 or (receipt->>'solde_restant')::numeric is distinct from 70000 then raise exception 'Le reçu doit exclure le versement postérieur.'; end if;
    raise exception 'ROLLBACK_FIXTURES_AFTER_PASS';
  exception when others then
    if sqlerrm='ROLLBACK_FIXTURES_AFTER_PASS' then raise notice 'PASS: courant 50000/50000; reçu historique 30000/70000; fixtures annulées.'; else raise; end if;
  end;
end
$test$;
