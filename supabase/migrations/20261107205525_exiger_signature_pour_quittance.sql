-- Une quittance n'est créée que si la signature du bailleur est enregistrée
-- et présente dans son bucket privé. Les reçus restent indépendants.
-- L'exception dans preparer_emission_quittance annule aussi une validation de
-- paiement faite dans la même transaction : aucun paiement ni document n'est
-- partiellement modifié quand la signature manque.

create or replace function public.preparer_emission_quittance(
  p_acteur uuid,
  p_paiement uuid,
  p_valider boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c jsonb;
  q public.quittances;
  token uuid := gen_random_uuid();
  vient_valider boolean := false;
  e prive.emissions_quittance;
  p public.paiements;
begin
  c := prive.contexte_emission(p_acteur, p_paiement);
  if (c->'paiement'->>'historique')::boolean
     or c->'paiement'->>'date_paiement' is null then
    raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
  end if;

  if c->'paiement'->>'statut' = 'Brouillon' and p_valider then
    update public.paiements
      set statut = 'Validé', valide_le = now()
      where id = p_paiement;
    vient_valider := true;
    c := prive.contexte_emission(p_acteur, p_paiement);
    update public.paiements
      set est_partiel = (c->'finances'->>'est_partiel')::boolean
      where id = p_paiement;
    c := prive.contexte_emission(p_acteur, p_paiement);
  elsif c->'paiement'->>'statut' <> 'Validé' then
    raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
  end if;

  select * into q
    from public.quittances
    where paiement_id = p_paiement
    for update;
  select * into p from public.paiements where id = p_paiement;

  if q.id is not null then
    -- Une confirmation répétée d'un document déjà publié reste une lecture
    -- idempotente : elle ne dépend pas de la signature actuelle du profil.
    if p_valider and not vient_valider and q.pdf_chemin is not null
      and q.hash_sha256 is not null and q.bailleur_id = p_acteur
      and ((q.donnees_financieres->>'empreinte_paiement') = encode(prive.empreinte_paiement_locatif(p), 'hex')
        or (q.donnees_financieres is null and not exists (
          select 1 from prive.finances_emission f where f.paiement_id = p.id
        ))) then
      return jsonb_build_object('deja_publiee', true, 'quittance', to_jsonb(q));
    end if;

    if q.bailleur_id is distinct from p_acteur
       or (q.pdf_chemin is null and q.hash_sha256 is not null)
       or (exists(select 1 from public.signatures_apposees where quittance_id = q.id)
           and (c->'paiement'->>'valide_le')::timestamptz <= now() - interval '5 minutes'
           and not exists(select 1 from prive.finances_emission f
             where f.paiement_id = p.id
               and f.remplace_publication
               and f.empreinte_paiement = prive.empreinte_paiement_locatif(p))) then
      raise exception 'Émission impossible pour ce paiement.' using errcode = '23514';
    end if;
  end if;

  -- La même règle que typeDocumentPaiement : seul un loyer dont le statut de
  -- paiement est explicitement complet produit une quittance. Une valeur
  -- inconnue, un reçu de charges et un dépôt restent des reçus.
  if c->'finances'->>'type_paiement' = 'Loyer'
     and c->'finances'->'est_partiel' = 'false'::jsonb
     and not exists (
       select 1
       from public.bailleurs a
       join storage.objects o
         on o.bucket_id = 'signatures'
        and o.name = a.signature_chemin
       where a.id = p_acteur
         and a.signature_chemin ~ ('^' || p_acteur::text || '/signature\.(png|jpe?g|webp)$')
     ) then
    raise exception 'SIGNATURE_QUITTANCE_REQUISE' using errcode = 'P0001';
  end if;

  if q.id is null then
    insert into public.quittances(bailleur_id, paiement_id, numero_document, type, pays)
    values (
      p_acteur,
      p_paiement,
      null,
      case
        when c->'finances'->>'type_paiement' = 'Loyer'
          and c->'finances'->'est_partiel' = 'false'::jsonb
          then 'Quittance'::public.type_document
        else 'Reçu'::public.type_document
      end,
      coalesce(c->'logement'->>'pays', 'Bénin')
    ) returning * into q;
  end if;

  select * into e
    from prive.emissions_quittance
    where paiement_id = p_paiement
    for update;
  if e.paiement_id is not null
     and e.cree_le > now() - interval '5 minutes'
     and e.empreinte_contexte = sha256(convert_to(c::text, 'UTF8')) then
    return jsonb_build_object('en_cours', true, 'quittance', to_jsonb(q));
  end if;

  select * into p from public.paiements where id = p_paiement;
  insert into prive.finances_emission(paiement_id, empreinte_paiement, finances, remplace_publication)
  values (
    p.id,
    prive.empreinte_paiement_locatif(p),
    c->'finances',
    (vient_valider and q.pdf_chemin is not null)
      or exists(select 1 from prive.finances_emission f
        where f.paiement_id = p.id
          and f.empreinte_paiement = prive.empreinte_paiement_locatif(p)
          and f.remplace_publication)
  )
  on conflict(paiement_id) do update
    set empreinte_paiement = excluded.empreinte_paiement,
        finances = excluded.finances,
        remplace_publication = excluded.remplace_publication;

  insert into prive.emissions_quittance(paiement_id, jeton, acteur, quittance_id, empreinte_contexte)
  values (p_paiement, token, p_acteur, q.id, sha256(convert_to(c::text, 'UTF8')))
  on conflict(paiement_id) do update
    set jeton = excluded.jeton,
        acteur = excluded.acteur,
        quittance_id = excluded.quittance_id,
        empreinte_contexte = excluded.empreinte_contexte,
        cree_le = now();

  return jsonb_build_object('jeton', token, 'contexte', c, 'quittance', to_jsonb(q));
end
$$;

revoke all on function public.preparer_emission_quittance(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.preparer_emission_quittance(uuid, uuid, boolean)
  to service_role;

create or replace function public.publier_emission_quittance(
  p_acteur uuid,
  p_paiement uuid,
  p_jeton uuid,
  p_hash text,
  p_snapshot text default null,
  p_hash_signature text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c jsonb;
  e prive.emissions_quittance;
  q public.quittances;
  chemin text;
  exige_signature boolean;
begin
  c := prive.contexte_emission(p_acteur, p_paiement);
  select * into e
    from prive.emissions_quittance
    where paiement_id = p_paiement
    for update;
  if e.jeton is distinct from p_jeton
     or e.acteur is distinct from p_acteur
     or e.empreinte_contexte is distinct from sha256(convert_to(c::text, 'UTF8'))
     or c->'paiement'->>'statut' <> 'Validé'
     or e.cree_le < now() - interval '5 minutes' then
    raise exception 'Émission périmée : recommencez.' using errcode = '40001';
  end if;

  select * into q from public.quittances where id = e.quittance_id for update;
  if q.id is null or q.bailleur_id is distinct from p_acteur then
    raise exception 'Opération non autorisée.' using errcode = '42501';
  end if;

  exige_signature := c->'finances'->>'type_paiement' = 'Loyer'
    and c->'finances'->'est_partiel' = 'false'::jsonb;

  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
     or (p_hash_signature is not null and p_hash_signature !~ '^[0-9a-f]{64}$')
     or (p_snapshot is not null and p_snapshot !~ ('^' || p_acteur::text || '/apposees/' || p_jeton::text || '\.(png|jpe?g|webp)$')) then
    raise exception 'Document invalide.' using errcode = '23514';
  end if;

  if exige_signature and (
    p_snapshot is null
    or p_hash_signature is null
    or not exists (
      select 1
      from public.bailleurs a
      join storage.objects original
        on original.bucket_id = 'signatures'
       and original.name = a.signature_chemin
      join storage.objects copie
        on copie.bucket_id = 'signatures'
       and copie.name = p_snapshot
      where a.id = p_acteur
        and a.signature_chemin ~ ('^' || p_acteur::text || '/signature\.(png|jpe?g|webp)$')
    )
  ) then
    raise exception 'SIGNATURE_QUITTANCE_REQUISE' using errcode = 'P0001';
  end if;

  -- Le trigger existant protège l'apposition historique; l'archive garde les
  -- octets et snapshots précédents sans jamais les remplacer par la signature
  -- actuelle du profil.
  if q.pdf_chemin is not null and q.hash_sha256 is not null then
    insert into prive.versions_quittance(
      quittance_id, paiement_id, bailleur_id, numero_document, type, finances,
      pdf_chemin, hash_sha256, signature_snapshot, publie_le
    )
    values (
      q.id, p_paiement, p_acteur, q.numero_document, q.type,
      q.donnees_financieres, q.pdf_chemin, q.hash_sha256,
      (select chemin_snapshot from public.signatures_apposees where quittance_id = q.id),
      q.date_generation
    )
    on conflict(quittance_id, pdf_chemin) do nothing;
  end if;

  delete from public.signatures_apposees where quittance_id = q.id;
  chemin := p_acteur::text || '/' || q.numero_document || '-' || p_jeton::text || '.pdf';
  update public.quittances set
    type = case when exige_signature
      then 'Quittance'::public.type_document
      else 'Reçu'::public.type_document
    end,
    pdf_chemin = chemin,
    hash_sha256 = p_hash,
    donnees_financieres = c->'finances'
  where id = q.id;

  insert into public.signatures_apposees(
    quittance_id, bailleur_id, nom_signataire, chemin_snapshot, hash_document, hash_signature
  ) values (q.id, p_acteur, c->'bailleur'->>'nom', p_snapshot, p_hash, p_hash_signature);

  insert into prive.versions_quittance(
    quittance_id, paiement_id, bailleur_id, numero_document, type, finances,
    pdf_chemin, hash_sha256, signature_snapshot
  )
  select q.id, p_paiement, p_acteur, q.numero_document, d.type,
    d.donnees_financieres, chemin, p_hash, p_snapshot
  from public.quittances d where d.id = q.id;

  update prive.finances_emission
    set remplace_publication = false
    where paiement_id = p_paiement;
  delete from prive.emissions_quittance where paiement_id = p_paiement;
end
$$;

revoke all on function public.publier_emission_quittance(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.publier_emission_quittance(uuid, uuid, uuid, text, text, text)
  to service_role;
