-- C2 : cumuls validés, valeurs financières figées et reprise d'émission.
-- Additif : aucune mise à jour des paiements/documents historiques.
alter table public.quittances add column donnees_financieres jsonb;
create table prive.finances_emission (
  paiement_id uuid primary key references public.paiements(id) on delete cascade,
  empreinte_paiement bytea not null,
  finances jsonb not null,
  remplace_publication boolean not null default false
);
alter table prive.finances_emission enable row level security;
revoke all on prive.finances_emission from public,anon,authenticated,service_role;
-- Les versions survivent à la correction/annulation d'un paiement, sans FK
-- vers celui-ci. La suppression du compte conserve son comportement en cascade.
create table prive.versions_quittance (
  id uuid primary key default gen_random_uuid(),
  quittance_id uuid not null,
  paiement_id uuid not null,
  bailleur_id uuid not null references public.bailleurs(id) on delete cascade,
  numero_document text not null,
  type public.type_document not null,
  finances jsonb,
  pdf_chemin text not null,
  hash_sha256 text not null,
  signature_snapshot text,
  publie_le timestamptz not null default now(),
  unique(quittance_id,pdf_chemin)
);
alter table prive.versions_quittance enable row level security;
revoke all on prive.versions_quittance from public,anon,authenticated,service_role;

-- Le verrou de statement précède les verrous de ligne, y compris pour les
-- écritures directes sous RLS. Aucune transaction ne reste ouverte pour le PDF.
create function prive.verrou_paiements_locatifs() returns trigger
language plpgsql security invoker set search_path='' as $$
begin perform pg_advisory_xact_lock(72150302); return null; end $$;
revoke all on function prive.verrou_paiements_locatifs() from public,anon,authenticated;
create trigger a_verrou_paiements_locatifs before insert or update or delete on public.paiements
  for each statement execute function prive.verrou_paiements_locatifs();

create function prive.empreinte_paiement_locatif(p public.paiements) returns bytea
language sql immutable security invoker set search_path='' as $$
 select sha256(convert_to(jsonb_build_object('id',p.id,'bailleur_id',p.bailleur_id,
   'bail_id',p.bail_id,'montant',p.montant,'periode_debut',p.periode_debut,
   'periode_fin',p.periode_fin,'date_paiement',p.date_paiement,'mode_paiement',p.mode_paiement,
   'type_paiement',p.type_paiement,'statut',p.statut,'valide_le',p.valide_le,
   'historique',p.historique)::text,'UTF8'));
$$;
revoke all on function prive.empreinte_paiement_locatif(public.paiements) from public,anon,authenticated;

create function prive.finances_paiement_locatif(p public.paiements,loyer numeric) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare f jsonb; cumul numeric; versements jsonb;
begin
 select e.finances into f from prive.finances_emission e
 where e.paiement_id=p.id and e.empreinte_paiement=prive.empreinte_paiement_locatif(p)
 and not exists (
   select 1 from jsonb_array_elements(e.finances->'versements') v
   left join public.paiements x on x.id=(v->>'id')::uuid
   where x.id is null or encode(prive.empreinte_paiement_locatif(x),'hex')<>v->>'empreinte'
 );
 -- Les versements ultérieurs ne réécrivent pas un reçu antérieur.
 if f is not null then return f; end if;
 select coalesce(sum(x.montant),0),coalesce(jsonb_agg(jsonb_build_object(
   'id',x.id,'empreinte',encode(prive.empreinte_paiement_locatif(x),'hex')) order by x.id),'[]'::jsonb)
 into cumul,versements from public.paiements x
 where x.bail_id=p.bail_id and x.bailleur_id=p.bailleur_id
   and x.periode_debut=p.periode_debut and x.type_paiement='Loyer' and x.statut='Validé';
 return jsonb_build_object('empreinte_paiement',encode(prive.empreinte_paiement_locatif(p),'hex'),'montant',p.montant,'cumul_loyer',cumul,'loyer_mensuel',loyer,
   'solde_restant',greatest(0,loyer-cumul),
   'est_partiel',p.type_paiement='Loyer' and cumul<loyer,
   'periode_debut',p.periode_debut,'periode_fin',p.periode_fin,
   'date_paiement',p.date_paiement,'mode_paiement',p.mode_paiement,'type_paiement',p.type_paiement,
   'versements',versements);
end $$;
revoke all on function prive.finances_paiement_locatif(public.paiements,numeric) from public,anon,authenticated;

create or replace function prive.contexte_emission(p_acteur uuid, p_paiement uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.paiements; b public.baux; l public.logements;
  t public.locataires; a public.bailleurs;
begin
  perform pg_advisory_xact_lock(72150302);
  select * into p from public.paiements where id = p_paiement for update;
  if p.id is null or p.bailleur_id is distinct from p_acteur then
    raise exception 'Opération non autorisée.' using errcode = '42501';
  end if;
  select * into b from public.baux where id = p.bail_id for share;
  select * into l from public.logements where id = b.logement_id for share;
  select * into t from public.locataires where id = b.locataire_id for share;
  select * into a from public.bailleurs where id = p_acteur for share;
  if b.id is null or l.id is null or t.id is null or a.id is null
    or b.bailleur_id is distinct from p_acteur
    or l.bailleur_id is distinct from p_acteur
    or t.bailleur_id is distinct from p_acteur
    or a.statut_abonnement not in ('actif', 'grace') then
    raise exception 'Opération non autorisée.' using errcode = '42501';
  end if;
  return jsonb_build_object('paiement',to_jsonb(p),'bail',to_jsonb(b),
    'logement',to_jsonb(l),'locataire',to_jsonb(t),'bailleur',to_jsonb(a),
    'finances',case when p.statut='Validé' then prive.finances_paiement_locatif(p,b.loyer_mensuel) else null end);
end $$;
revoke all on function prive.contexte_emission(uuid,uuid) from public, anon, authenticated;

-- L'acteur est fourni EXCLUSIVEMENT par le serveur après auth.getUser().
-- Cette RPC n'est pas exécutable avec un JWT utilisateur, ni anonymement.
create or replace function public.preparer_emission_quittance(p_acteur uuid, p_paiement uuid, p_valider boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c jsonb; q public.quittances; token uuid := gen_random_uuid();
  vient_valider boolean:=false; e prive.emissions_quittance; p public.paiements;
begin
  c := prive.contexte_emission(p_acteur,p_paiement);
  if (c->'paiement'->>'historique')::boolean
     or c->'paiement'->>'date_paiement' is null then
    raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
  end if;
  if c->'paiement'->>'statut' = 'Brouillon' and p_valider then
    update public.paiements set statut='Validé', valide_le=now() where id=p_paiement;
    vient_valider:=true;
    c := prive.contexte_emission(p_acteur,p_paiement);
    update public.paiements set est_partiel=(c->'finances'->>'est_partiel')::boolean where id=p_paiement;
    c := prive.contexte_emission(p_acteur,p_paiement);
  elsif c->'paiement'->>'statut' <> 'Validé' then
    raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
  end if;
  select * into q from public.quittances where paiement_id=p_paiement for update;
  select * into p from public.paiements where id=p_paiement;
  if q.id is not null then
    -- Une confirmation répétée n'est pas une demande de régénération.
    if p_valider and not vient_valider and q.pdf_chemin is not null
      and q.hash_sha256 is not null and q.bailleur_id=p_acteur
      and ((q.donnees_financieres->>'empreinte_paiement')=encode(prive.empreinte_paiement_locatif(p),'hex')
        or (q.donnees_financieres is null and not exists(
          select 1 from prive.finances_emission f where f.paiement_id=p.id))) then
      return jsonb_build_object('deja_publiee',true,'quittance',to_jsonb(q));
    end if;
    if q.bailleur_id is distinct from p_acteur
       or (q.pdf_chemin is null and q.hash_sha256 is not null)
       or (exists(select 1 from public.signatures_apposees where quittance_id=q.id)
           and (c->'paiement'->>'valide_le')::timestamptz <= now()-interval '5 minutes'
           and not exists(select 1 from prive.finances_emission f
             where f.paiement_id=p.id and f.remplace_publication
               and f.empreinte_paiement=prive.empreinte_paiement_locatif(p))) then
      raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
    end if;
  else
    insert into public.quittances(bailleur_id,paiement_id,numero_document,type,pays)
    values(p_acteur,p_paiement,null,
      case when (c->'finances'->>'est_partiel')::boolean then 'Reçu'::public.type_document else 'Quittance'::public.type_document end,
      coalesce(c->'logement'->>'pays','Bénin')) returning * into q;
  end if;
  select * into e from prive.emissions_quittance where paiement_id=p_paiement for update;
  if e.paiement_id is not null and e.cree_le>now()-interval '5 minutes'
     and e.empreinte_contexte=sha256(convert_to(c::text,'UTF8')) then
    return jsonb_build_object('en_cours',true,'quittance',to_jsonb(q));
  end if;
  select * into p from public.paiements where id=p_paiement;
  insert into prive.finances_emission(paiement_id,empreinte_paiement,finances,remplace_publication)
    values(p.id,prive.empreinte_paiement_locatif(p),c->'finances',
      (vient_valider and q.pdf_chemin is not null)
      or exists(select 1 from prive.finances_emission f where f.paiement_id=p.id
        and f.empreinte_paiement=prive.empreinte_paiement_locatif(p) and f.remplace_publication))
    on conflict(paiement_id) do update set empreinte_paiement=excluded.empreinte_paiement,finances=excluded.finances,remplace_publication=excluded.remplace_publication;
  insert into prive.emissions_quittance(paiement_id,jeton,acteur,quittance_id,empreinte_contexte)
    values(p_paiement,token,p_acteur,q.id,sha256(convert_to(c::text,'UTF8')))
    on conflict(paiement_id) do update set jeton=excluded.jeton,acteur=excluded.acteur,
      quittance_id=excluded.quittance_id,empreinte_contexte=excluded.empreinte_contexte,cree_le=now();
  return jsonb_build_object('jeton',token,'contexte',c,'quittance',to_jsonb(q));
end $$;
revoke all on function public.preparer_emission_quittance(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.preparer_emission_quittance(uuid,uuid,boolean) to service_role;

create or replace function public.publier_emission_quittance(
  p_acteur uuid, p_paiement uuid, p_jeton uuid, p_hash text,
  p_snapshot text default null, p_hash_signature text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare c jsonb; e prive.emissions_quittance; q public.quittances; chemin text;
begin
  c := prive.contexte_emission(p_acteur,p_paiement);
  select * into e from prive.emissions_quittance where paiement_id=p_paiement for update;
  if e.jeton is distinct from p_jeton or e.acteur is distinct from p_acteur
     or e.empreinte_contexte is distinct from sha256(convert_to(c::text,'UTF8')) or c->'paiement'->>'statut' <> 'Validé'
     or e.cree_le < now()-interval '5 minutes' then
    raise exception 'Émission périmée : recommencez.' using errcode = '40001';
  end if;
  select * into q from public.quittances where id=e.quittance_id for update;
  if q.id is null or q.bailleur_id is distinct from p_acteur then
    raise exception 'Opération non autorisée.' using errcode = '42501';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
     or (p_hash_signature is not null and p_hash_signature !~ '^[0-9a-f]{64}$')
     or (p_snapshot is not null and p_snapshot !~ ('^'||p_acteur::text||'/apposees/'||p_jeton::text||'\.(png|jpe?g|webp)$')) then
    raise exception 'Document invalide.' using errcode='23514';
  end if;
  -- Le trigger existant refuse la suppression d'une signature après 5 minutes.
  -- Suppression, publication et nouvelle apposition sont dans UNE transaction.
  -- Archive aussi la version antérieure au dispositif, sans inventer ses
  -- valeurs si aucun instantané financier n'existait encore.
  if q.pdf_chemin is not null and q.hash_sha256 is not null then
    insert into prive.versions_quittance(quittance_id,paiement_id,bailleur_id,numero_document,
      type,finances,pdf_chemin,hash_sha256,signature_snapshot,publie_le)
      values(q.id,p_paiement,p_acteur,q.numero_document,q.type,q.donnees_financieres,
        q.pdf_chemin,q.hash_sha256,(select chemin_snapshot from public.signatures_apposees where quittance_id=q.id),q.date_generation)
      on conflict(quittance_id,pdf_chemin) do nothing;
  end if;
  delete from public.signatures_apposees where quittance_id=q.id;
  chemin := p_acteur::text||'/'||q.numero_document||'-'||p_jeton::text||'.pdf';
  update public.quittances set
    type=case when (c->'finances'->>'est_partiel')::boolean then 'Reçu'::public.type_document else 'Quittance'::public.type_document end,
    pdf_chemin=chemin, hash_sha256=p_hash,donnees_financieres=c->'finances' where id=q.id;
  insert into public.signatures_apposees(quittance_id,bailleur_id,nom_signataire,chemin_snapshot,hash_document,hash_signature)
    values(q.id,p_acteur,c->'bailleur'->>'nom',p_snapshot,p_hash,p_hash_signature);
  insert into prive.versions_quittance(quittance_id,paiement_id,bailleur_id,numero_document,
    type,finances,pdf_chemin,hash_sha256,signature_snapshot)
    select q.id,p_paiement,p_acteur,q.numero_document,d.type,d.donnees_financieres,chemin,p_hash,p_snapshot
      from public.quittances d where d.id=q.id;
  update prive.finances_emission set remplace_publication=false where paiement_id=p_paiement;
  delete from prive.emissions_quittance where paiement_id=p_paiement;
end $$;
revoke all on function public.publier_emission_quittance(uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.publier_emission_quittance(uuid,uuid,uuid,text,text,text) to service_role;

-- Lecture privilégiée autorisée en une seule instruction : aucun id/chemin
-- provenant du navigateur n'est utilisé comme capacité d'accès Storage.
create or replace function public.lire_quittance_autorisee(p_acteur uuid, p_quittance uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('quittance',to_jsonb(q),'signee',exists(
      select 1 from public.signatures_apposees s where s.quittance_id=q.id),
    'contexte',jsonb_build_object('paiement',to_jsonb(p),'bail',to_jsonb(b),
      'logement',to_jsonb(l),'locataire',to_jsonb(t),'bailleur',to_jsonb(a),
      'finances',coalesce(q.donnees_financieres,prive.finances_paiement_locatif(p,b.loyer_mensuel))))
  from public.quittances q
  join public.paiements p on p.id=q.paiement_id and p.bailleur_id=q.bailleur_id
  join public.baux b on b.id=p.bail_id and b.bailleur_id=p.bailleur_id
  join public.logements l on l.id=b.logement_id and l.bailleur_id=p.bailleur_id
  join public.locataires t on t.id=b.locataire_id and t.bailleur_id=p.bailleur_id
  join public.bailleurs a on a.id=p.bailleur_id
  where q.id=p_quittance and p.statut='Validé'
    -- Un ancien PDF ne devient pas la publication d'un paiement corrigé.
    and ((q.pdf_chemin is null and q.hash_sha256 is null)
      or (q.donnees_financieres->>'empreinte_paiement')=encode(prive.empreinte_paiement_locatif(p),'hex')
      or (q.donnees_financieres is null and not exists(
        select 1 from prive.finances_emission f where f.paiement_id=p.id)))
    and (p_acteur=a.id or p_acteur=t.compte_id);
$$;
revoke all on function public.lire_quittance_autorisee(uuid,uuid) from public, anon, authenticated;
grant execute on function public.lire_quittance_autorisee(uuid,uuid) to service_role;

-- Un échec confirmé libère immédiatement le seul jeton de sa tentative.
create function public.liberer_emission_quittance(p_acteur uuid,p_paiement uuid,p_jeton uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(72150302);
  delete from prive.emissions_quittance e where e.paiement_id=p_paiement
    and e.acteur=p_acteur and e.jeton=p_jeton
    and exists(select 1 from public.paiements p where p.id=p_paiement and p.bailleur_id=p_acteur);
end $$;
revoke all on function public.liberer_emission_quittance(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.liberer_emission_quittance(uuid,uuid,uuid) to service_role;

-- La signature de l'ancienne version est déjà archivée avant son retrait.
-- Une reprise d'une CORRECTION validée peut terminer après la fenêtre; elle
-- ne modifie aucun paiement figé et ne réécrit pas l'ancienne preuve.
create or replace function prive.refuser_suppression_signature()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.quittances where id=old.quittance_id) then return old; end if;
  if exists(select 1 from public.quittances q join public.paiements p on p.id=q.paiement_id
    where q.id=old.quittance_id and p.statut='Validé' and p.valide_le>now()-interval '5 minutes') then return old; end if;
  if exists(
    select 1 from public.quittances q join public.paiements p on p.id=q.paiement_id
    join prive.finances_emission f on f.paiement_id=p.id
    join prive.emissions_quittance e on e.paiement_id=p.id and e.quittance_id=q.id and e.acteur=p.bailleur_id
    join prive.versions_quittance v on v.quittance_id=q.id and v.pdf_chemin=q.pdf_chemin
      and v.hash_sha256=old.hash_document
    where q.id=old.quittance_id and p.statut='Validé' and f.remplace_publication
      and f.empreinte_paiement=prive.empreinte_paiement_locatif(p)
      and (q.donnees_financieres->>'empreinte_paiement') is distinct from encode(f.empreinte_paiement,'hex')
  ) then return old; end if;
  raise exception 'Une signature apposée ne se supprime pas : le paiement est figé.' using errcode='23514';
end $$;
