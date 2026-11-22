-- Limitation des connexions atomique et multi-critères (SEC-03).
--
-- Avant : le serveur comptait les échecs d'un email, puis appelait Auth, puis
-- enregistrait l'échec. Des requêtes parallèles passaient toutes le contrôle
-- avant la première écriture, et 5 échecs suffisaient à quiconque pour bloquer
-- le compte d'un bailleur pendant 15 minutes.
--
-- Après : l'essai est réservé sous verrou AVANT l'appel à Auth, et trois
-- compteurs s'appliquent sur 15 minutes glissantes :
--   * couple email + IP : 5 échecs (la règle §6.1.1 pour un utilisateur) ;
--   * email, toutes IP  : 20 échecs (attaque répartie sur un compte) ;
--   * IP, tous emails   : 30 échecs (bourrage d'identifiants).
-- Un essai refusé n'est pas enregistré : il ne prolonge pas le blocage.

create index if not exists tentatives_connexion_ip_idx
  on public.tentatives_connexion (ip, tentee_le desc)
  where reussie = false and ip is not null;

create or replace function public.reserver_tentative_connexion(p_email text, p_ip text)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ip text := nullif(btrim(coalesce(p_ip, '')), '');
  v_depuis timestamptz := now() - interval '15 minutes';
  v_fin timestamptz;
  v_id bigint;
begin
  if v_email = '' or length(v_email) > 320 or length(coalesce(v_ip, '')) > 64 then
    raise exception 'Tentative de connexion invalide.' using errcode = '22023';
  end if;

  -- Verrous toujours pris dans le même ordre (email puis IP) : pas d'interblocage.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('connexion:email:' || v_email));
  if v_ip is not null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('connexion:ip:' || v_ip));
  end if;

  -- Pour chaque compteur dépassé, le blocage court jusqu'à ce que l'échec le
  -- plus ancien encore compté sorte de la fenêtre.
  select max(fin) into v_fin from (
    select (array_agg(t.tentee_le order by t.tentee_le desc))[5] + interval '15 minutes' as fin
      from public.tentatives_connexion t
     where lower(t.email) = v_email and t.reussie = false and t.tentee_le >= v_depuis
       and t.ip is not distinct from v_ip
    having count(*) >= 5
    union all
    select (array_agg(t.tentee_le order by t.tentee_le desc))[20] + interval '15 minutes'
      from public.tentatives_connexion t
     where lower(t.email) = v_email and t.reussie = false and t.tentee_le >= v_depuis
    having count(*) >= 20
    union all
    select (array_agg(t.tentee_le order by t.tentee_le desc))[30] + interval '15 minutes'
      from public.tentatives_connexion t
     where v_ip is not null and t.ip = v_ip and t.reussie = false and t.tentee_le >= v_depuis
    having count(*) >= 30
  ) limites;

  if v_fin is not null and v_fin > now() then
    return jsonb_build_object(
      'bloque', true,
      'minutes_restantes', greatest(1, ceil(extract(epoch from (v_fin - now())) / 60)::int)
    );
  end if;

  -- Réservé comme échec : une requête interrompue reste comptée.
  insert into public.tentatives_connexion (email, reussie, ip)
  values (v_email, false, v_ip)
  returning id into v_id;

  return jsonb_build_object('bloque', false, 'tentative_id', v_id);
end;
$$;

comment on function public.reserver_tentative_connexion(text, text) is
  'Réserve un essai de connexion sous verrou et applique les limites email+IP (5), email (20) et IP (30) sur 15 minutes. Serveur uniquement.';

create or replace function public.conclure_tentative_connexion(p_tentative_id bigint)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_email text;
  v_ip text;
begin
  update public.tentatives_connexion
     set reussie = true
   where id = p_tentative_id and reussie = false
  returning email, ip into v_email, v_ip;

  if v_email is null then return; end if;

  -- Une connexion réussie efface les échecs de ce couple email + IP. Les
  -- échecs venus d'autres adresses restent comptés pour ce compte.
  delete from public.tentatives_connexion
   where lower(email) = v_email and reussie = false
     and ip is not distinct from v_ip;
end;
$$;

comment on function public.conclure_tentative_connexion(bigint) is
  'Marque une tentative réservée comme réussie et efface les échecs du même couple email + IP. Serveur uniquement.';

revoke all on function public.reserver_tentative_connexion(text, text) from public, anon, authenticated;
revoke all on function public.conclure_tentative_connexion(bigint) from public, anon, authenticated;
grant execute on function public.reserver_tentative_connexion(text, text) to service_role;
grant execute on function public.conclure_tentative_connexion(bigint) to service_role;
