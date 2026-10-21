-- Lot B : autorisation atomique des émissions et moindre privilège commercial.
-- Les migrations historiques restent inchangées. À appliquer avant le code.

-- Révoquer aussi les droits de table/defaults : une révocation de colonne
-- seule ne neutraliserait pas une autorisation plus large.
revoke all on public.bailleurs from public, anon, authenticated;
do $$
declare c record;
begin
  for c in select attname from pg_attribute
    where attrelid = 'public.bailleurs'::regclass and attnum > 0 and not attisdropped
  loop
    execute format('revoke all (%I) on public.bailleurs from public, anon, authenticated', c.attname);
  end loop;
end $$;
grant select on public.bailleurs to authenticated;
grant update (
  nom, telephone, adresse, avatar, avatar_temporaire_depuis,
  nb_logements_declare, notif_email, notif_whatsapp, onboarding_termine,
  photo_chemin, signature_chemin, tutoriel_vu_le, visite_quittee_le
) on public.bailleurs to authenticated;
-- Pas de changement des politiques RLS propriétaire ni des droits service_role.
revoke all on function prive.reactiver_abonnement(uuid) from public, anon, authenticated;
grant execute on function prive.reactiver_abonnement(uuid) to service_role;

-- Échec explicite si une installation possède un héritage non prévu.
do $$
begin
  if has_column_privilege('authenticated','public.bailleurs','plan','UPDATE')
     or has_column_privilege('authenticated','public.bailleurs','date_fin_abonnement','UPDATE')
     or has_column_privilege('authenticated','public.bailleurs','statut_abonnement','UPDATE')
     or has_column_privilege('authenticated','public.bailleurs','date_echec_paiement','UPDATE') then
    raise exception 'Privilèges commerciaux hérités inattendus';
  end if;
end $$;

-- Neutraliser aussi les privilèges de table implicites sur les actes émis.
-- TRUNCATE contourne RLS; aucun rôle utilisateur n'en a besoin ici.
revoke all on public.quittances, public.signatures_apposees from public, anon, authenticated;
grant select on public.quittances, public.signatures_apposees to authenticated;
-- Ces parents permettent autrement une suppression en cascade hors RLS.
revoke truncate on public.paiements, public.baux, public.logements, public.locataires from public, anon, authenticated;
-- Les preuves de paiement commercial/récompenses sont serveur uniquement.
revoke all on public.abonnements_transactions, public.recompenses_parrainage from public, anon, authenticated;
grant select on public.abonnements_transactions, public.recompenses_parrainage to authenticated;

-- Une réservation par paiement. Le jeton arbitre les générations concurrentes;
-- une empreinte du contexte refuse la publication après une correction, sans
-- conserver une copie supplémentaire des données personnelles.
create table prive.emissions_quittance (
  paiement_id uuid primary key references public.paiements(id) on delete cascade,
  jeton uuid not null unique,
  acteur uuid not null references public.bailleurs(id),
  quittance_id uuid not null references public.quittances(id) on delete cascade,
  empreinte_contexte bytea not null,
  cree_le timestamptz not null default now()
);
alter table prive.emissions_quittance enable row level security;
revoke all on prive.emissions_quittance from public, anon, authenticated, service_role;

-- Les verrous ne couvrent que les transactions SQL, jamais le rendu/Storage.
-- Toutes les écritures ultérieures sont conditionnées au même contexte.
create function prive.contexte_emission(p_acteur uuid, p_paiement uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p public.paiements; b public.baux; l public.logements;
  t public.locataires; a public.bailleurs;
begin
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
    'logement',to_jsonb(l),'locataire',to_jsonb(t),'bailleur',to_jsonb(a));
end $$;
revoke all on function prive.contexte_emission(uuid,uuid) from public, anon, authenticated;

-- L'acteur est fourni EXCLUSIVEMENT par le serveur après auth.getUser().
-- Cette RPC n'est pas exécutable avec un JWT utilisateur, ni anonymement.
create function public.preparer_emission_quittance(p_acteur uuid, p_paiement uuid, p_valider boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c jsonb; q public.quittances; token uuid := gen_random_uuid();
begin
  c := prive.contexte_emission(p_acteur,p_paiement);
  if (c->'paiement'->>'historique')::boolean
     or c->'paiement'->>'date_paiement' is null then
    raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
  end if;
  if c->'paiement'->>'statut' = 'Brouillon' and p_valider then
    update public.paiements set statut='Validé', valide_le=now() where id=p_paiement;
    c := prive.contexte_emission(p_acteur,p_paiement);
  elsif c->'paiement'->>'statut' <> 'Validé' then
    raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
  end if;
  select * into q from public.quittances where paiement_id=p_paiement for update;
  if q.id is not null then
    if q.bailleur_id is distinct from p_acteur
       or (q.pdf_chemin is null and q.hash_sha256 is not null)
       or (exists(select 1 from public.signatures_apposees where quittance_id=q.id)
           and (c->'paiement'->>'valide_le')::timestamptz <= now()-interval '5 minutes') then
      raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
    end if;
  else
    insert into public.quittances(bailleur_id,paiement_id,numero_document,type,pays)
    values(p_acteur,p_paiement,null,
      case when (c->'paiement'->>'est_partiel')::boolean then 'Reçu'::public.type_document else 'Quittance'::public.type_document end,
      coalesce(c->'logement'->>'pays','Bénin')) returning * into q;
  end if;
  insert into prive.emissions_quittance(paiement_id,jeton,acteur,quittance_id,empreinte_contexte)
    values(p_paiement,token,p_acteur,q.id,sha256(convert_to(c::text,'UTF8')))
    on conflict(paiement_id) do update set jeton=excluded.jeton,acteur=excluded.acteur,
      quittance_id=excluded.quittance_id,empreinte_contexte=excluded.empreinte_contexte,cree_le=now();
  return jsonb_build_object('jeton',token,'contexte',c,'quittance',to_jsonb(q));
end $$;
revoke all on function public.preparer_emission_quittance(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.preparer_emission_quittance(uuid,uuid,boolean) to service_role;

create function public.publier_emission_quittance(
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
  delete from public.signatures_apposees where quittance_id=q.id;
  chemin := p_acteur::text||'/'||q.numero_document||'-'||p_jeton::text||'.pdf';
  update public.quittances set
    type=case when (c->'paiement'->>'est_partiel')::boolean then 'Reçu'::public.type_document else 'Quittance'::public.type_document end,
    pdf_chemin=chemin, hash_sha256=p_hash where id=q.id;
  insert into public.signatures_apposees(quittance_id,bailleur_id,nom_signataire,chemin_snapshot,hash_document,hash_signature)
    values(q.id,p_acteur,c->'bailleur'->>'nom',p_snapshot,p_hash,p_hash_signature);
  delete from prive.emissions_quittance where paiement_id=p_paiement;
end $$;
revoke all on function public.publier_emission_quittance(uuid,uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.publier_emission_quittance(uuid,uuid,uuid,text,text,text) to service_role;

-- Lecture privilégiée autorisée en une seule instruction : aucun id/chemin
-- provenant du navigateur n'est utilisé comme capacité d'accès Storage.
create function public.lire_quittance_autorisee(p_acteur uuid, p_quittance uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('quittance',to_jsonb(q),'signee',exists(
      select 1 from public.signatures_apposees s where s.quittance_id=q.id),
    'contexte',jsonb_build_object('paiement',to_jsonb(p),'bail',to_jsonb(b),
      'logement',to_jsonb(l),'locataire',to_jsonb(t),'bailleur',to_jsonb(a)))
  from public.quittances q
  join public.paiements p on p.id=q.paiement_id and p.bailleur_id=q.bailleur_id
  join public.baux b on b.id=p.bail_id and b.bailleur_id=p.bailleur_id
  join public.logements l on l.id=b.logement_id and l.bailleur_id=p.bailleur_id
  join public.locataires t on t.id=b.locataire_id and t.bailleur_id=p.bailleur_id
  join public.bailleurs a on a.id=p.bailleur_id
  where q.id=p_quittance and p.statut='Validé'
    and (p_acteur=a.id or p_acteur=t.compte_id);
$$;
revoke all on function public.lire_quittance_autorisee(uuid,uuid) from public, anon, authenticated;
grant execute on function public.lire_quittance_autorisee(uuid,uuid) to service_role;
