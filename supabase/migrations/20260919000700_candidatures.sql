-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S8-A — candidats et candidatures
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Où vit un candidat ────────────────────────────────────────────────────
--
-- Nulle part, jusqu'ici. Sikaloc connaît deux profils : `bailleurs`, adossé au
-- compte, et `locataires`, une FICHE écrite par un bailleur. Un compte qui
-- n'est ni l'un ni l'autre ne porte ni nom ni téléphone : `auth.users` ne
-- garde que l'email et des métadonnées que le navigateur peut réécrire.
--
-- `candidats` est donc le profil du compte qui candidate, sur le modèle exact
-- de `bailleurs` : la clé primaire EST l'identifiant du compte. Un compte a au
-- plus un profil candidat, par construction — aucune contrainte d'unicité à
-- ajouter, aucun `candidat_id` à choisir depuis un navigateur.
--
-- Le nom et le téléphone y sont stockés parce qu'ils n'existent nulle part
-- ailleurs pour ce compte. L'email ne l'est pas : il vit dans `auth.users`, et
-- une copie divergerait au premier changement d'adresse.
--
-- ─── Ce que devient l'historique quand un compte disparaît ─────────────────
--
-- Les deux règles du projet, reprises telles quelles :
--
--     bailleurs.id       → auth.users   ON DELETE CASCADE   (le profil meurt)
--     locataires.compte_id → auth.users ON DELETE SET NULL  (la fiche survit)
--
-- Ici : `candidats.id` casse avec le compte, et `candidatures.candidat_id`
-- passe à NULL. Côté bailleur, la suppression de SON compte emporte ses
-- annonces, et donc les candidatures qui les visaient : il ne reste pas de
-- dossier sur une annonce qui n'existe plus. Le bailleur garde l'historique de ce qui s'est passé sur son
-- annonce ; l'identité, elle, s'en va avec le compte. C'est une anonymisation,
-- pas une suppression — et pas une invention : c'est déjà ce que fait une
-- fiche locataire.
--
-- ─── Rien de public ────────────────────────────────────────────────────────
--
-- Aucun droit pour `anon`, aucune fonction ouverte au public, rien dans les
-- projections de Find. Une candidature ne se montre qu'à deux personnes : son
-- candidat, et le bailleur de l'annonce visée.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.statut_candidature as enum (
  'envoyee', 'en_etude', 'acceptee', 'refusee', 'retiree'
);

-- ─── Candidats ─────────────────────────────────────────────────────────────

create table public.candidats (
  id             uuid primary key references auth.users (id) on delete cascade,
  nom            text not null,
  telephone      text not null,
  created_at     timestamptz not null default now(),
  mis_a_jour_le  timestamptz not null default now()
);

comment on table public.candidats is
  'Profil du compte qui candidate. Un compte, un profil : la clé primaire est l''identifiant du compte, comme pour les bailleurs.';

alter table public.candidats
  add constraint candidats_nom_longueur check (length(trim(nom)) between 2 and 120);

alter table public.candidats
  add constraint candidats_telephone_longueur check (length(trim(telephone)) between 8 and 20);

create trigger canoniser_telephone
  before insert or update of telephone on public.candidats
  for each row execute function prive.canoniser_telephone();

create trigger toucher_candidats
  before update on public.candidats
  for each row execute function prive.toucher_mis_a_jour_le();

-- ─── Candidatures ──────────────────────────────────────────────────────────

create table public.candidatures (
  id             uuid primary key default gen_random_uuid(),
  -- NULL après la suppression du compte : la candidature reste, l'identité part.
  candidat_id    uuid references public.candidats (id) on delete set null,
  -- L'identifiant INTERNE de l'annonce. La référence publique est une porte
  -- d'entrée, pas une clé étrangère.
  --
  -- CASCADE, et non RESTRICT : une annonce ne se supprime que si elle est
  -- encore un brouillon (déclencheur de S1), et un brouillon ne reçoit aucune
  -- candidature (déclencheur ci-dessous). Le seul chemin qui efface vraiment
  -- une annonce portant des candidatures est donc la suppression du COMPTE du
  -- bailleur, qui emporte déjà ses logements et ses annonces. RESTRICT y
  -- aurait rendu tout compte de bailleur indéracinable dès la première
  -- candidature reçue — une régression du droit à l'effacement.
  annonce_id     uuid not null references public.annonces (id) on delete cascade,
  statut         public.statut_candidature not null default 'envoyee',
  -- Ce que le candidat écrit de lui-même. Facultatif.
  message        text,
  -- Horodatage de la décision du bailleur (acceptée ou refusée).
  repondue_le    timestamptz,
  created_at     timestamptz not null default now(),
  mis_a_jour_le  timestamptz not null default now()
);

comment on table public.candidatures is
  'Une candidature sur une annonce publiée. Jamais publique : son candidat et le bailleur de l''annonce, personne d''autre.';

alter table public.candidatures
  add constraint candidatures_message_longueur
  check (message is null or length(trim(message)) between 1 and 1000);

alter table public.candidatures
  add constraint candidatures_reponse_coherente
  check ((statut in ('acceptee', 'refusee')) = (repondue_le is not null));

-- Une candidature par annonce et par candidat, retirées comprises.
--
-- Une candidature retirée reste : elle raconte qu'on s'est présenté puis
-- désisté. Autoriser une seconde candidature reviendrait à effacer cela, et
-- ouvrirait la porte au harcèlement d'un bailleur par retraits successifs.
--
-- Partiel, parce que `candidat_id` devient NULL à la suppression du compte :
-- deux candidatures anonymisées sur la même annonce sont possibles, et ne
-- gênent personne.
create unique index candidatures_une_par_candidat_et_annonce
  on public.candidatures (candidat_id, annonce_id)
  where candidat_id is not null;

create index candidatures_annonce_idx on public.candidatures (annonce_id, created_at desc);
create index candidatures_candidat_idx on public.candidatures (candidat_id, created_at desc);

create trigger toucher_candidatures
  before update on public.candidatures
  for each row execute function prive.toucher_mis_a_jour_le();

-- ─── On ne candidate qu'à une annonce publiée ──────────────────────────────
--
-- Vérifié en base, pas dans un formulaire : brouillon, suspendue et clôturée
-- refusent toute nouvelle candidature, quel que soit le chemin d'écriture.
-- Les candidatures DÉJÀ déposées, elles, survivent à la suspension comme à la
-- clôture : c'est l'historique de l'annonce.

create or replace function prive.verifier_annonce_candidature()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_statut public.statut_annonce;
begin
  select a.statut into v_statut from public.annonces a where a.id = new.annonce_id;

  if v_statut is null then
    raise exception 'Annonce introuvable.' using errcode = 'check_violation';
  end if;

  if v_statut <> 'publiee' then
    raise exception 'Cette annonce n''accepte pas de candidature.'
      using errcode = 'check_violation';
  end if;

  if new.candidat_id is null then
    raise exception 'Une candidature naît toujours rattachée à un candidat.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger verifier_annonce_candidature
  before insert on public.candidatures
  for each row execute function prive.verifier_annonce_candidature();

-- ─── Les transitions, et qui a le droit de les demander ────────────────────
--
--     envoyée ──┬─ (bailleur) ─→ en étude ──┬─ (bailleur) ─→ acceptée ·fin
--               │                           └─ (bailleur) ─→ refusée
--               ├─ (bailleur) ─→ acceptée ·fin
--               ├─ (bailleur) ─→ refusée
--               └─ (candidat) ─→ retirée  ·fin
--
--     refusée ── (bailleur) ─→ en étude      un refus peut se reconsidérer :
--                                            sans cela, l'unicité par annonce
--                                            en ferait une impasse définitive.
--
-- « acceptée » et « retirée » sont terminales. Le reste de la ligne ne bouge
-- jamais : ni le candidat, ni l'annonce, ni le message, ni la date de dépôt.

create or replace function prive.verifier_transition_candidature()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_acteur uuid := (select auth.uid());
  v_bailleur uuid;
  v_candidat boolean;
  v_proprietaire boolean;
begin
  if new.candidat_id is distinct from old.candidat_id
     and not (old.candidat_id is not null and new.candidat_id is null) then
    raise exception 'Le candidat d''une candidature ne change pas.' using errcode = 'check_violation';
  end if;
  if new.annonce_id is distinct from old.annonce_id
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at then
    raise exception 'Cette partie d''une candidature ne se modifie pas.' using errcode = 'check_violation';
  end if;

  if new.statut = old.statut then
    return new;
  end if;

  select a.bailleur_id into v_bailleur from public.annonces a where a.id = new.annonce_id;
  v_candidat := v_acteur is not null and v_acteur = old.candidat_id;
  v_proprietaire := v_acteur is not null and v_acteur = v_bailleur;

  -- Le candidat retire, et c'est tout ce qu'il peut faire.
  if new.statut = 'retiree' then
    if v_acteur is not null and not v_candidat then
      raise exception 'Seul le candidat retire sa candidature.' using errcode = 'check_violation';
    end if;
    if old.statut not in ('envoyee', 'en_etude') then
      raise exception 'Cette candidature ne peut plus être retirée.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Tout le reste appartient au bailleur de l'annonce.
  if v_acteur is not null and not v_proprietaire then
    raise exception 'Seul le bailleur de l''annonce répond à une candidature.'
      using errcode = 'check_violation';
  end if;

  if not (
    (old.statut = 'envoyee'  and new.statut in ('en_etude', 'acceptee', 'refusee'))
    or (old.statut = 'en_etude' and new.statut in ('acceptee', 'refusee'))
    or (old.statut = 'refusee'  and new.statut = 'en_etude')
  ) then
    raise exception 'Cette candidature ne peut plus changer d''état.' using errcode = 'check_violation';
  end if;

  if new.statut in ('acceptee', 'refusee') then
    new.repondue_le := coalesce(new.repondue_le, now());
  else
    new.repondue_le := null;
  end if;

  return new;
end;
$$;

create trigger verifier_transition_candidature
  before update on public.candidatures
  for each row execute function prive.verifier_transition_candidature();

-- ─── Qui voit quoi ─────────────────────────────────────────────────────────
--
-- Rien pour `anon`. Pour `authenticated`, deux regards et deux seulement :
-- le candidat sur ses candidatures, le bailleur sur celles de SES annonces —
-- le lien passe par l'annonce, jamais par un identifiant transmis.
--
-- Aucune politique de suppression : une candidature ne s'efface pas, elle se
-- retire. Un profil candidat disparaît avec son compte.

alter table public.candidats    enable row level security;
alter table public.candidatures enable row level security;

revoke all on public.candidats    from anon, authenticated;
revoke all on public.candidatures from anon, authenticated;

grant select, insert, update on public.candidats    to authenticated;
grant select, insert, update on public.candidatures to authenticated;

create policy "Un candidat lit son profil"
  on public.candidats for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Un candidat crée son profil"
  on public.candidats for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "Un candidat modifie son profil"
  on public.candidats for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Un candidat lit ses candidatures"
  on public.candidatures for select
  to authenticated
  using ((select auth.uid()) = candidat_id);

create policy "Un candidat dépose sa candidature"
  on public.candidatures for insert
  to authenticated
  with check ((select auth.uid()) = candidat_id);

create policy "Un candidat retire sa candidature"
  on public.candidatures for update
  to authenticated
  using ((select auth.uid()) = candidat_id)
  with check ((select auth.uid()) = candidat_id);

create policy "Un bailleur lit les candidatures de ses annonces"
  on public.candidatures for select
  to authenticated
  using (
    exists (
      select 1 from public.annonces a
       where a.id = candidatures.annonce_id
         and a.bailleur_id = (select auth.uid())
    )
  );

create policy "Un bailleur répond aux candidatures de ses annonces"
  on public.candidatures for update
  to authenticated
  using (
    exists (
      select 1 from public.annonces a
       where a.id = candidatures.annonce_id
         and a.bailleur_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.annonces a
       where a.id = candidatures.annonce_id
         and a.bailleur_id = (select auth.uid())
    )
  );

-- ─── Les portes ────────────────────────────────────────────────────────────
--
-- Quatre fonctions, toutes réservées aux comptes connectés, toutes rendant un
-- MOTIF plutôt qu'une exception : le code SQL d'une contrainte n'a rien à
-- faire dans un navigateur. Le modèle est `accepter_invitation` (S1).

create or replace function public.enregistrer_profil_candidat(p_nom text, p_telephone text)
returns table (motif text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_compte uuid := (select auth.uid());
begin
  if v_compte is null then
    return query select 'authentification_requise'::text;
    return;
  end if;
  if p_nom is null or length(trim(p_nom)) < 2 or length(trim(p_nom)) > 120 then
    return query select 'nom_invalide'::text;
    return;
  end if;
  if p_telephone is null or length(trim(p_telephone)) < 8 or length(trim(p_telephone)) > 20 then
    return query select 'telephone_invalide'::text;
    return;
  end if;

  insert into public.candidats (id, nom, telephone)
  values (v_compte, trim(p_nom), trim(p_telephone))
  on conflict (id) do update set nom = excluded.nom, telephone = excluded.telephone;

  return query select 'ok'::text;
end;
$$;

comment on function public.enregistrer_profil_candidat(text, text) is
  'Crée ou met à jour le profil candidat du compte appelant. Un compte, un profil.';

revoke all on function public.enregistrer_profil_candidat(text, text) from public, anon;
grant execute on function public.enregistrer_profil_candidat(text, text) to authenticated;

-- Déposer une candidature, en une seule opération.
--
-- L'appelant ne fournit que la référence publique et, s'il le veut, un
-- message : le candidat, c'est sa session qui le dit. `SECURITY DEFINER`
-- parce qu'il faut traduire la référence en annonce, ce qu'aucun candidat ne
-- peut faire lui-même — et cette traduction ne révèle rien : elle ne sert
-- qu'à insérer.
create or replace function public.soumettre_candidature(p_reference text, p_message text default null)
returns table (candidature_id uuid, motif text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid := (select auth.uid());
  v_annonce uuid;
  v_id uuid;
begin
  if v_compte is null then
    return query select null::uuid, 'authentification_requise'::text;
    return;
  end if;
  if not exists (select 1 from public.candidats c where c.id = v_compte) then
    return query select null::uuid, 'profil_absent'::text;
    return;
  end if;
  if p_message is not null and length(trim(p_message)) > 1000 then
    return query select null::uuid, 'message_trop_long'::text;
    return;
  end if;

  -- Introuvable et non publiée se répondent pareil : un candidat n'apprend
  -- pas qu'une annonce existe mais se cache.
  select a.id into v_annonce
    from public.annonces a
   where p_reference ~ '^[0-9a-hjkmnp-tv-z]{10}$'
     and a.reference = p_reference
     and a.statut = 'publiee';

  if v_annonce is null then
    return query select null::uuid, 'annonce_indisponible'::text;
    return;
  end if;

  begin
    insert into public.candidatures (candidat_id, annonce_id, message)
    values (v_compte, v_annonce, nullif(trim(coalesce(p_message, '')), ''))
    returning id into v_id;
  exception
    when unique_violation then
      -- Deux envois simultanés : l'index tranche, et le second le dit
      -- proprement.
      return query select null::uuid, 'deja_candidate'::text;
      return;
    when check_violation then
      -- L'annonce a changé d'état entre la lecture et l'écriture.
      return query select null::uuid, 'annonce_indisponible'::text;
      return;
  end;

  return query select v_id, 'ok'::text;
end;
$$;

comment on function public.soumettre_candidature(text, text) is
  'Dépose une candidature sur une annonce publiée, pour le compte appelant. Rend un motif, jamais une erreur SQL.';

revoke all on function public.soumettre_candidature(text, text) from public, anon;
grant execute on function public.soumettre_candidature(text, text) to authenticated;

-- Ce que le CANDIDAT voit de ses candidatures : son dossier, et de quoi
-- reconnaître l'annonce — les mêmes colonnes publiques que la vitrine.
create or replace function public.mes_candidatures()
returns table (
  candidature_id  uuid,
  statut          public.statut_candidature,
  message         text,
  deposee_le      timestamptz,
  repondue_le     timestamptz,
  reference       text,
  annonce_type    public.type_logement,
  annonce_ville   text,
  annonce_quartier text,
  annonce_loyer   integer,
  annonce_statut  public.statut_annonce
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.statut, c.message, c.created_at, c.repondue_le,
    a.reference, a.type, a.ville, a.quartier, a.loyer, a.statut
  from public.candidatures c
  join public.annonces a on a.id = c.annonce_id
  where c.candidat_id = (select auth.uid())
  order by c.created_at desc;
$$;

comment on function public.mes_candidatures() is
  'Les candidatures du compte appelant, avec les informations publiques de l''annonce visée.';

revoke all on function public.mes_candidatures() from public, anon;
grant execute on function public.mes_candidatures() to authenticated;

-- Ce que le BAILLEUR voit : le strict nécessaire pour instruire un dossier.
--
-- Le nom du candidat, son message, l'état, les dates. PAS son téléphone, PAS
-- son email : les transmettre demande le consentement du candidat, et le
-- moment de le recueillir n'existe pas encore (S8-B). Un profil candidat
-- supprimé laisse une ligne sans nom, jamais une ligne fantôme.
create or replace function public.candidatures_de_mes_annonces(p_reference text default null)
returns table (
  candidature_id  uuid,
  reference       text,
  statut          public.statut_candidature,
  message         text,
  deposee_le      timestamptz,
  repondue_le     timestamptz,
  candidat_nom    text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, a.reference, c.statut, c.message, c.created_at, c.repondue_le,
    cand.nom
  from public.candidatures c
  join public.annonces a on a.id = c.annonce_id
  left join public.candidats cand on cand.id = c.candidat_id
  where a.bailleur_id = (select auth.uid())
    and (p_reference is null or a.reference = p_reference)
  order by c.created_at desc;
$$;

comment on function public.candidatures_de_mes_annonces(text) is
  'Les candidatures reçues sur les annonces du bailleur appelant. Nom du candidat seulement — ni téléphone, ni email.';

revoke all on function public.candidatures_de_mes_annonces(text) from public, anon;
grant execute on function public.candidatures_de_mes_annonces(text) to authenticated;

-- Retirer, répondre : deux gestes, deux fonctions.
--
-- `SECURITY INVOKER` : ce sont les politiques qui décident qui touche quoi, et
-- le déclencheur qui décide si la transition est permise. Ces fonctions ne
-- font que traduire un refus en motif — une ligne introuvable et une ligne
-- interdite se répondent pareil.

create or replace function public.retirer_candidature(p_candidature_id uuid)
returns table (motif text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_touchees int;
begin
  if (select auth.uid()) is null then
    return query select 'authentification_requise'::text;
    return;
  end if;

  begin
    update public.candidatures c
       set statut = 'retiree'
     where c.id = p_candidature_id
       and c.candidat_id = (select auth.uid());
    get diagnostics v_touchees = row_count;
  exception
    when check_violation then
      return query select 'retrait_impossible'::text;
      return;
  end;

  return query select case when v_touchees = 1 then 'ok' else 'introuvable' end::text;
end;
$$;

comment on function public.retirer_candidature(uuid) is
  'Le candidat retire sa candidature. Elle reste en base, marquée « retirée ».';

revoke all on function public.retirer_candidature(uuid) from public, anon;
grant execute on function public.retirer_candidature(uuid) to authenticated;

create or replace function public.repondre_candidature(
  p_candidature_id uuid,
  p_statut public.statut_candidature
)
returns table (motif text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_touchees int;
begin
  if (select auth.uid()) is null then
    return query select 'authentification_requise'::text;
    return;
  end if;
  -- « Retirée » appartient au candidat : le bailleur ne le demande pas ici.
  if p_statut not in ('en_etude', 'acceptee', 'refusee') then
    return query select 'reponse_invalide'::text;
    return;
  end if;

  begin
    update public.candidatures c
       set statut = p_statut
     where c.id = p_candidature_id
       and exists (
         select 1 from public.annonces a
          where a.id = c.annonce_id and a.bailleur_id = (select auth.uid())
       );
    get diagnostics v_touchees = row_count;
  exception
    when check_violation then
      return query select 'transition_refusee'::text;
      return;
  end;

  return query select case when v_touchees = 1 then 'ok' else 'introuvable' end::text;
end;
$$;

comment on function public.repondre_candidature(uuid, public.statut_candidature) is
  'Le bailleur met une candidature de SON annonce en étude, l''accepte ou la refuse.';

revoke all on function public.repondre_candidature(uuid, public.statut_candidature) from public, anon;
grant execute on function public.repondre_candidature(uuid, public.statut_candidature) to authenticated;
