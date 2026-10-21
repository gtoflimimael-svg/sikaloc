-- C1 : finalisation et crédit indivisibles. Après la sécurité du lot B.
-- Aucun historique REGLEE n'est recrédité sans preuve d'un crédit antérieur.
alter table public.abonnements_transactions
  add column reference_fedapay text,
  add column environnement_fedapay text check (environnement_fedapay in ('sandbox','live')),
  add column contrat_fedapay text not null default 'historique' check (contrat_fedapay in ('historique','standard_v1')),
  add column formule text not null default 'Standard' check (formule = 'Standard');
create unique index abonnements_reference_fedapay_unique
  on public.abonnements_transactions(environnement_fedapay,reference_fedapay)
  where reference_fedapay is not null;

-- Journal comptable minimal : pas de payload opérateur ni de données client.
create table prive.credits_abonnement (
  transaction_id uuid primary key references public.abonnements_transactions(id) on delete cascade,
  bailleur_id uuid not null references public.bailleurs(id) on delete cascade,
  reference_fedapay text not null,
  environnement_fedapay text not null check (environnement_fedapay in ('sandbox','live')),
  mois_payes smallint not null check (mois_payes=1),
  mois_bonus smallint not null check (mois_bonus in (0,1)),
  date_fin_avant date,
  date_fin_apres date not null,
  credite_le timestamptz not null default now(),
  unique(environnement_fedapay,reference_fedapay)
);
alter table prive.credits_abonnement enable row level security;
revoke all on prive.credits_abonnement from public,anon,authenticated,service_role;
-- Ne pas élargir les droits commerciaux verrouillés par le lot B.
revoke all on public.abonnements_transactions from public,anon,authenticated;
grant select on public.abonnements_transactions to authenticated;

-- Conserve la sémantique JS Date.setMonth existante, y compris le report
-- des jours en fin de mois (31 janvier + un mois -> début mars).
create function prive.prolonger_abonnement(p_fin date, p_mois integer)
returns date language sql stable security invoker set search_path='' as $$
  select ((date_trunc('month',greatest(coalesce(p_fin,(now() at time zone 'UTC')::date),
    (now() at time zone 'UTC')::date)::timestamp) + make_interval(months=>p_mois))::date
    + (extract(day from greatest(coalesce(p_fin,(now() at time zone 'UTC')::date),
       (now() at time zone 'UTC')::date))::integer-1));
$$;
revoke all on function prive.prolonger_abonnement(date,integer) from public,anon,authenticated;

-- Les arguments sont une preuve normalisée obtenue par GET FedaPay avec la
-- clé secrète serveur. Aucune donnée du webhook ne doit être transmise ici.
create function public.finaliser_abonnement_fedapay(
  p_transaction_id text, p_reference text, p_bailleur uuid,
  p_montant numeric, p_devise text, p_statut text,
  p_formule text, p_environnement text
) returns text language plpgsql security definer set search_path='' as $$
declare t public.abonnements_transactions; b public.bailleurs; parrain public.bailleurs;
  bonus smallint:=0; attribution uuid; nouvelle_fin date;
begin
  if p_transaction_id is null or p_transaction_id !~ '^[1-9][0-9]{0,19}$'
    or p_reference is null or length(p_reference) not between 1 and 200
    or p_bailleur is null or p_montant is distinct from 5000::numeric
    or p_devise is distinct from 'XOF' or p_formule is distinct from 'Standard'
    or p_environnement is null or p_environnement not in ('sandbox','live')
    or p_statut is null or p_statut not in ('approved','transferred','pending','started','declined','canceled','failed') then
    return 'inconnu';
  end if;

  -- Sérialise les courts traitements commerciaux, dont les parrainages croisés.
  -- Aucun appel réseau dans cette transaction. Évite les mises à jour perdues
  -- de date de fin et les deadlocks entre filleul et parrain réciproques.
  perform pg_advisory_xact_lock(72150301);
  select * into t from public.abonnements_transactions
    where transaction_id=p_transaction_id for update;
  if t.id is null or t.bailleur_id is distinct from p_bailleur
    or t.montant is distinct from p_montant or t.devise is distinct from p_devise
    or t.formule is distinct from p_formule
    or (t.reference_fedapay is not null and t.reference_fedapay is distinct from p_reference)
    or (t.environnement_fedapay is not null and t.environnement_fedapay is distinct from p_environnement) then
    return 'inconnu';
  end if;
  if exists(select 1 from prive.credits_abonnement where transaction_id=t.id) then
    return 'deja_regle';
  end if;
  -- Avant C1, REGLEE pouvait signifier crédit fait OU panne entre les écritures.
  -- Impossible de distinguer ces deux cas automatiquement sans risquer un double.
  if t.statut='REGLEE' then return 'a_reconcilier'; end if;
  if exists(select 1 from prive.credits_abonnement
      where reference_fedapay=p_reference and environnement_fedapay=p_environnement) then
    return 'inconnu';
  end if;
  select * into b from public.bailleurs where id=t.bailleur_id for update;
  if b.id is null then raise exception 'Bénéficiaire indisponible' using errcode='23503'; end if;

  if p_statut not in ('approved','transferred') then
    update public.abonnements_transactions set statut=upper(p_statut),
      reference_fedapay=p_reference,environnement_fedapay=p_environnement where id=t.id;
    if p_statut in ('declined','canceled','failed') then
      -- Une notification ancienne ne rouvre pas un impayé après un paiement
      -- plus récent; un échec répété ne redémarre pas son cycle de grâce.
      if b.date_echec_paiement is null and not exists(
        select 1 from prive.credits_abonnement c
        join public.abonnements_transactions payee on payee.id=c.transaction_id
        where c.bailleur_id=b.id and payee.created_at>=t.created_at
      ) then
        update public.bailleurs set date_echec_paiement=now(),statut_abonnement='grace' where id=b.id;
      end if;
      return 'echec';
    end if;
    return 'en_attente';
  end if;

  if (b.plan<>'Standard' or b.date_fin_abonnement is null)
    and b.parrain_id is not null and b.parrain_id<>b.id then
    select * into parrain from public.bailleurs where id=b.parrain_id for update;
    if parrain.id is not null then
      insert into public.recompenses_parrainage(parrain_id,filleul_id,mois_offerts)
        values(parrain.id,b.id,1) on conflict(parrain_id,filleul_id) do nothing
        returning id into attribution;
      if attribution is not null then
        bonus:=1;
        update public.bailleurs set plan='Standard',
          date_fin_abonnement=prive.prolonger_abonnement(parrain.date_fin_abonnement,1)
          where id=parrain.id;
      end if;
    end if;
  end if;
  nouvelle_fin:=prive.prolonger_abonnement(b.date_fin_abonnement,1+bonus);
  update public.bailleurs set plan='Standard',date_fin_abonnement=nouvelle_fin,
    statut_abonnement='actif',date_echec_paiement=null,dernier_rappel_envoye=null
    where id=b.id;
  delete from public.emails_a_envoyer where bailleur_id=b.id
    and modele in ('grace_j0','grace_j3','grace_j30','purge_j90');
  insert into prive.credits_abonnement(transaction_id,bailleur_id,reference_fedapay,
    environnement_fedapay,mois_payes,mois_bonus,date_fin_avant,date_fin_apres)
    values(t.id,b.id,p_reference,p_environnement,1,bonus,b.date_fin_abonnement,nouvelle_fin);
  -- Toujours dans la même transaction que les dates, récompenses et journal.
  update public.abonnements_transactions set statut='REGLEE',
    reference_fedapay=p_reference,environnement_fedapay=p_environnement,
    payload_notif=jsonb_build_object('reference',p_reference,'status',p_statut,
      'amount',p_montant,'currency',p_devise,'formule',p_formule)
    where id=t.id;
  return 'credite';
end $$;
revoke all on function public.finaliser_abonnement_fedapay(text,text,uuid,numeric,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.finaliser_abonnement_fedapay(text,text,uuid,numeric,text,text,text,text)
  to service_role;
