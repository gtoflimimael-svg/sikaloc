-- D1 : destinataire confirmé et sérialisation des acceptations. Additif.
create or replace function public.accepter_invitation(p_empreinte text)
returns table (locataire_id uuid, bailleur_id uuid, motif text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid := (select auth.uid());
  v_invitation record;
  v_locataire public.locataires;
  v_email text;
begin
  if v_compte is null then
    return query select null::uuid, null::uuid, 'authentification_requise'::text;
    return;
  end if;

  select i.* into v_invitation
    from public.invitations_locataire i
   where i.empreinte = p_empreinte
   limit 1 for update;

  if not found then
    return query select null::uuid, null::uuid, 'introuvable'::text;
    return;
  end if;

  if v_invitation.utilisee_le is not null then
    return query select null::uuid, null::uuid, 'deja_utilisee'::text;
    return;
  end if;

  if v_invitation.annulee_le is not null then
    return query select null::uuid, null::uuid, 'annulee'::text;
    return;
  end if;

  if v_invitation.expire_le < now() then
    return query select null::uuid, null::uuid, 'expiree'::text;
    return;
  end if;

  -- Identité issue du compte Auth confirmé, pas des métadonnées modifiables.
  select lower(trim(u.email)) into v_email from auth.users u
    where u.id=v_compte and u.email_confirmed_at is not null;
  if v_email is null or v_email is distinct from lower(trim(v_invitation.email)) then
    return query select null::uuid, null::uuid, 'introuvable'::text;
    return;
  end if;

  select * into v_locataire from public.locataires
    where id=v_invitation.locataire_id for update;
  if v_locataire.id is null or v_locataire.bailleur_id is distinct from v_invitation.bailleur_id then
    return query select null::uuid, null::uuid, 'introuvable'::text;
    return;
  end if;

  -- La ligne est-elle déjà rattachée à quelqu'un d'autre ? Le cas arrive si
  -- deux invitations ont été émises et acceptées par deux comptes différents.
  -- On ne réécrit pas un rattachement existant : la première acceptation fait
  -- foi, et la seconde est refusée plutôt que d'écraser en silence.
  if exists (
    select 1 from public.locataires l
     where l.id = v_invitation.locataire_id
       and l.compte_id is not null
       and l.compte_id <> v_compte
  ) then
    return query select null::uuid, null::uuid, 'deja_rattache'::text;
    return;
  end if;

  update public.locataires l
     set compte_id = v_compte,
         compte_lie_le = coalesce(l.compte_lie_le, now())
   where l.id = v_invitation.locataire_id;

  update public.invitations_locataire i
     set utilisee_le = now()
   where i.id = v_invitation.id
     and i.utilisee_le is null;

  return query
    select v_invitation.locataire_id, v_invitation.bailleur_id, 'ok'::text;
end;
$$;

revoke all on function public.accepter_invitation(text) from public, anon;
grant execute on function public.accepter_invitation(text) to authenticated;
