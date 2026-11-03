-- =============================================================================
-- Questions publiques — réception privée et limitation des soumissions
-- =============================================================================
-- Les demandes sont écrites uniquement par le serveur avec service_role.
-- Aucune policy n'ouvre les coordonnées ou le contenu des messages aux rôles
-- anon/authenticated, y compris en lecture.

create table public.questions_visiteurs (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(btrim(nom)) between 2 and 120),
  sujet text not null check (sujet in (
    'pro', 'me', 'find', 'tarifs_abonnements', 'compte_connexion', 'autre'
  )),
  question text not null check (char_length(btrim(question)) between 5 and 3000),
  canal_reponse text not null check (canal_reponse in ('email', 'whatsapp')),
  coordonnees text not null check (char_length(btrim(coordonnees)) between 7 and 254),
  consentement boolean not null check (consentement is true),
  consentie_le timestamptz not null default now(),
  statut text not null default 'nouvelle'
    check (statut in ('nouvelle', 'en_cours', 'repondue')),
  repondue_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint questions_visiteurs_reponse_coherente check (
    (statut = 'repondue' and repondue_le is not null)
    or (statut <> 'repondue' and repondue_le is null)
  ),
  constraint questions_visiteurs_coordonnees_coherentes check (
    (canal_reponse = 'email' and coordonnees ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (canal_reponse = 'whatsapp' and coordonnees ~ '^\+[1-9][0-9]{7,14}$')
  )
);

create index questions_visiteurs_statut_cree_idx
  on public.questions_visiteurs (statut, cree_le desc);

comment on table public.questions_visiteurs is
  'Questions envoyées volontairement via le formulaire public. Données personnelles accessibles uniquement au serveur et aux administrateurs explicitement autorisés.';
comment on column public.questions_visiteurs.coordonnees is
  'Une seule coordonnée, correspondant au canal choisi par la personne.';
comment on column public.questions_visiteurs.consentie_le is
  'Horodatage serveur du consentement explicite au traitement de la demande.';

alter table public.questions_visiteurs enable row level security;
revoke all on table public.questions_visiteurs from public, anon, authenticated;
grant all on table public.questions_visiteurs to service_role;

-- Empreintes HMAC d'adresses IP, sans adresse brute ni lien vers la demande.
-- Les lignes inactives depuis 24 h sont supprimées lors de la requête suivante.
create table public.limites_questions_visiteurs (
  empreinte char(64) primary key check (empreinte ~ '^[0-9a-f]{64}$'),
  fenetre_debut timestamptz not null,
  tentatives smallint not null check (tentatives between 1 and 6),
  modifie_le timestamptz not null default now()
);

create index limites_questions_visiteurs_expiration_idx
  on public.limites_questions_visiteurs (modifie_le);

comment on table public.limites_questions_visiteurs is
  'Compteurs anti-abus temporaires basés sur une empreinte HMAC, sans adresse IP brute. Nettoyage après 24 h d’inactivité.';

alter table public.limites_questions_visiteurs enable row level security;
revoke all on table public.limites_questions_visiteurs from public, anon, authenticated;
grant all on table public.limites_questions_visiteurs to service_role;

-- Compteur atomique par fenêtre de 15 minutes. SECURITY INVOKER : la fonction
-- ne gagne aucun privilège supplémentaire et n'est exécutable que par le
-- service_role serveur. Les clients publics ne peuvent ni l'appeler ni lire les
-- tables de compteur.
create or replace function public.consommer_limite_questions(p_empreinte text)
returns table (autorisee boolean, reessayer_apres integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ligne public.limites_questions_visiteurs%rowtype;
begin
  if current_user <> 'service_role' then
    raise exception 'Accès réservé au serveur.' using errcode = '42501';
  end if;

  if p_empreinte is null or p_empreinte !~ '^[0-9a-f]{64}$' then
    raise exception 'Empreinte invalide.' using errcode = '22023';
  end if;

  delete from public.limites_questions_visiteurs
  where modifie_le < pg_catalog.now() - interval '24 hours';

  insert into public.limites_questions_visiteurs as compteur (
    empreinte, fenetre_debut, tentatives, modifie_le
  ) values (
    p_empreinte, pg_catalog.now(), 1, pg_catalog.now()
  )
  on conflict (empreinte) do update set
    fenetre_debut = case
      when compteur.fenetre_debut <= pg_catalog.now() - interval '15 minutes'
        then pg_catalog.now()
      else compteur.fenetre_debut
    end,
    tentatives = case
      when compteur.fenetre_debut <= pg_catalog.now() - interval '15 minutes'
        then 1
      else least(compteur.tentatives + 1, 6)
    end,
    modifie_le = pg_catalog.now()
  returning * into v_ligne;

  return query select
    v_ligne.tentatives <= 5,
    greatest(
      1,
      ceil(extract(epoch from (
        v_ligne.fenetre_debut + interval '15 minutes' - pg_catalog.now()
      )))::integer
    );
end;
$$;

revoke all on function public.consommer_limite_questions(text)
  from public, anon, authenticated;
grant execute on function public.consommer_limite_questions(text) to service_role;
