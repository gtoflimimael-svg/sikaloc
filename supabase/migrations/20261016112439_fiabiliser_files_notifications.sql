-- Réservations atomiques et clôtures munies d'un jeton. Les producteurs,
-- destinataires et règles de consentement existants ne sont pas modifiés.
do $$
declare t text;
begin
  foreach t in array array['emails_a_envoyer','notifications_candidature','notifications_whatsapp'] loop
    execute format('alter table public.%I
      add column etat_traitement text not null default ''attente'' check (etat_traitement in (''attente'',''reserve'',''accepte'',''temporaire'',''definitif'',''indisponible'',''incertain'',''a_verifier'')),
      add column reservation uuid,
      add column reserve_jusqua timestamptz,
      add column prochain_essai timestamptz not null default now(),
      add column premiere_tentative timestamptz,
      add column transport_id text',t);
    execute format('update public.%I set etat_traitement=''accepte'' where envoye_le is not null',t);
    -- Les anciens échecs ne sont pas déclarés délivrés. Pas de réinitialisation du compteur.
    execute format('create index %I on public.%I (prochain_essai,cree_le,id) where envoye_le is null',t||'_reprise_idx',t);
  end loop;
end $$;

create function public.reserver_notification(p_file text, p_operationnel boolean)
returns setof jsonb language plpgsql security invoker set search_path = '' as $$
declare ligne jsonb;
begin
  if p_file not in ('emails_a_envoyer','notifications_candidature','notifications_whatsapp') then raise exception 'File interdite'; end if;
  if not p_operationnel then
    execute format('update public.%I set etat_traitement=''indisponible'' where envoye_le is null and etat_traitement in (''attente'',''temporaire'',''indisponible'')',p_file);
    return;
  end if;
  -- Une panne après l'appel transport est ambiguë, jamais un succès supposé.
  execute format('update public.%I set etat_traitement=''incertain'', reservation=null, reserve_jusqua=null where envoye_le is null and etat_traitement=''reserve'' and reserve_jusqua <= now()',p_file);
  -- Resend déduplique 24 h. Au-delà de 23 h, une ambiguïté exige une
  -- réconciliation opérateur, plutôt qu'un nouvel envoi potentiellement double.
  execute format('update public.%I set etat_traitement=''a_verifier'' where envoye_le is null and etat_traitement=''incertain'' and (premiere_tentative < now()-interval ''23 hours'' or tentatives>=8)',p_file);
  execute format('update public.%I set etat_traitement=''definitif'' where envoye_le is null and tentatives>=8 and etat_traitement in (''attente'',''temporaire'',''indisponible'')',p_file);
  return query execute format('with cible as (
    select id from public.%I where envoye_le is null and tentatives<8
      and etat_traitement in (''attente'',''temporaire'',''indisponible'',''incertain'')
      and prochain_essai<=now() order by cree_le,id for update skip locked limit 1
  ) update public.%I n set etat_traitement=''reserve'',reservation=gen_random_uuid(),
      reserve_jusqua=now()+interval ''5 minutes'', tentatives=n.tentatives+1,
      premiere_tentative=coalesce(n.premiere_tentative,now())
    from cible where n.id=cible.id returning to_jsonb(n)',p_file,p_file);
end $$;

create function public.terminer_notification(p_file text,p_id uuid,p_reservation uuid,p_etat text,p_transport_id text default null)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if p_file not in ('emails_a_envoyer','notifications_candidature','notifications_whatsapp') or p_etat not in ('accepte','temporaire','definitif','indisponible','incertain') then raise exception 'Clôture interdite'; end if;
  if p_etat='accepte' and coalesce(length(trim(p_transport_id)),0)=0 then raise exception 'Confirmation transport requise'; end if;
  execute format('update public.%I set
    etat_traitement=case when $3=''temporaire'' and tentatives>=8 then ''definitif'' else $3 end,
    envoye_le=case when $3=''accepte'' then now() else null end,
    transport_id=case when $3=''accepte'' then $4 else null end,
    derniere_erreur=case when $3=''accepte'' then null else $3 end,
    prochain_essai=now()+make_interval(mins=>least(60,power(2,least(tentatives,6))::integer)),
    tentatives=case when $3=''indisponible'' then greatest(0,tentatives-1) else tentatives end,
    reservation=null,reserve_jusqua=null
    where id=$1 and reservation=$2 and etat_traitement=''reserve'' and reserve_jusqua>now()',p_file)
    using p_id,p_reservation,p_etat,p_transport_id;
  get diagnostics n=row_count;return n=1;
end $$;
revoke all on function public.reserver_notification(text,boolean) from public,anon,authenticated;
revoke all on function public.terminer_notification(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserver_notification(text,boolean) to service_role;
grant execute on function public.terminer_notification(text,uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
