-- ═══════════════════════════════════════════════════════════════════════════
-- L'invitation : ce qui rattache une personne à un bail
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Pourquoi elle est le seul chemin ──────────────────────────────────────
--
-- Un compte locataire créé de lui-même ne serait relié à rien. Ce qui relie
-- une personne à un logement, à un bail, à des quittances, c'est le bailleur
-- qui le désigne — lui seul sait de quel bail il s'agit.
--
-- Un formulaire d'inscription ouvert produirait des comptes vides qu'il
-- faudrait rattacher après coup, en devinant. Deviner, ici, c'est risquer de
-- donner à quelqu'un les quittances de son voisin.
--
-- ─── Ce qui est stocké, et ce qui ne l'est pas ─────────────────────────────
--
-- Pas le jeton. Son empreinte HMAC-SHA256, calculée avec le même secret que
-- les codes de vérification. Un jeton d'invitation ouvre l'accès aux documents
-- de loyer d'une personne : s'il fuitait avec la table, il serait utilisable
-- tel quel.
--
-- L'empreinte est unique : c'est elle qui sert à retrouver l'invitation depuis
-- le lien, et deux jetons ne peuvent pas désigner la même.

create table if not exists public.invitations_locataire (
  id uuid primary key default gen_random_uuid(),

  -- La ligne locataire visée. C'est elle qui porte le rattachement au bail,
  -- au logement et à l'historique : l'invitation ne fait que désigner le
  -- compte qui viendra s'y attacher.
  locataire_id uuid not null references public.locataires(id) on delete cascade,
  bailleur_id  uuid not null references public.bailleurs(id)  on delete cascade,

  -- L'adresse à laquelle l'invitation part. Conservée telle qu'elle était au
  -- moment de l'envoi : si le bailleur corrige la fiche ensuite, l'invitation
  -- déjà partie reste vraie sur son propre compte.
  email text not null,

  -- HMAC-SHA256(jeton, OTP_SECRET). Jamais le jeton.
  empreinte text not null unique check (empreinte ~ '^[0-9a-f]{64}$'),

  expire_le  timestamptz not null,
  -- Consommée : un compte s'y est rattaché. Une invitation ne sert qu'une fois.
  utilisee_le timestamptz,
  -- Révoquée par le bailleur, ou périmée par un nouvel envoi.
  annulee_le  timestamptz,

  cree_le timestamptz not null default now(),
  cree_par uuid references public.bailleurs(id)
);

comment on table public.invitations_locataire is
  'Invitations à rejoindre Sikaloc_Me. Empreinte HMAC uniquement, jamais le jeton. Usage unique.';

-- Retrouver l'invitation courante d'un locataire — pour savoir s'il en a déjà
-- une en attente, et pour l'annuler avant d'en envoyer une nouvelle.
create index if not exists idx_invitations_locataire
  on public.invitations_locataire (locataire_id, cree_le desc);

-- ── Qui voit quoi ──────────────────────────────────────────────────────────
--
-- Le bailleur voit les invitations qu'il a émises : il doit pouvoir constater
-- qu'une invitation est partie, et la renvoyer.
--
-- Le locataire n'a AUCUN accès à cette table, et n'en a pas besoin : il
-- présente son jeton, et c'est le serveur qui en tire les conséquences. Lui
-- donner la lecture reviendrait à lui montrer les invitations des autres dès
-- qu'une politique serait mal écrite.
alter table public.invitations_locataire enable row level security;

revoke all on public.invitations_locataire from anon, authenticated;
grant select on public.invitations_locataire to authenticated;

drop policy if exists "Un bailleur lit ses invitations" on public.invitations_locataire;
create policy "Un bailleur lit ses invitations"
  on public.invitations_locataire
  for select
  to authenticated
  using ((select auth.uid()) = bailleur_id);

-- ── Le rattachement, en une seule opération ────────────────────────────────
--
-- ─── Pourquoi une fonction et pas trois requêtes ───────────────────────────
--
-- Parce que les trois écritures — consommer l'invitation, rattacher le compte,
-- horodater — doivent réussir ou échouer ensemble. Un rattachement sans
-- consommation laisserait un jeton réutilisable ; une consommation sans
-- rattachement enfermerait le locataire dehors avec un lien devenu inutile.
--
-- `SECURITY DEFINER` par nécessité : celui qui appelle est un locataire, et les
-- politiques de `locataires` ne rendent que les lignes du bailleur
-- propriétaire. Il ne pourrait ni lire ni écrire sa propre ligne.
--
-- Le verrou est dans la clause `where` : seule une invitation portant
-- exactement cette empreinte, non consommée, non annulée et non expirée est
-- acceptée. L'appelant ne choisit rien d'autre que le jeton qu'il présente.
create or replace function public.accepter_invitation(p_empreinte text)
returns table (locataire_id uuid, bailleur_id uuid, motif text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid := (select auth.uid());
  v_invitation record;
begin
  if v_compte is null then
    return query select null::uuid, null::uuid, 'authentification_requise'::text;
    return;
  end if;

  select i.* into v_invitation
    from public.invitations_locataire i
   where i.empreinte = p_empreinte
   limit 1;

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

comment on function public.accepter_invitation(text) is
  'Consomme une invitation et rattache le compte appelant à sa ligne locataire. Usage unique, atomique. Rend un motif de refus plutôt qu''une exception.';

revoke all on function public.accepter_invitation(text) from public, anon;
grant execute on function public.accepter_invitation(text) to authenticated;

-- ── Ménage ─────────────────────────────────────────────────────────────────
--
-- Une invitation expirée depuis un mois ne dit plus rien d'utile. Les
-- rattachements réussis sont tracés sur `locataires.compte_lie_le`, pas ici.
create or replace function prive.purger_invitations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supprimees integer;
begin
  delete from public.invitations_locataire
   where expire_le < now() - interval '30 days';

  get diagnostics v_supprimees = row_count;
  return v_supprimees;
end;
$$;

comment on function prive.purger_invitations() is
  'Supprime les invitations expirées depuis plus de 30 jours.';
