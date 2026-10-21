-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S8-D — les notifications de candidature
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Pourquoi une file, et pas un envoi direct ─────────────────────────────
--
-- Le projet connaît déjà les deux façons de faire. Les invitations et les
-- quittances partent depuis une Server Action, en direct : le bailleur vient
-- d'appuyer sur un bouton, il attend une réponse, et l'échec doit lui être
-- montré. Le cycle de grâce, lui, passe par `emails_a_envoyer` : les
-- transitions sont calculées en SQL, et l'intégrité d'un statut ne peut pas
-- dépendre de la disponibilité d'un service tiers.
--
-- Une candidature est du second genre. Personne n'attend l'email devant son
-- écran, et surtout : si Resend est indisponible, la candidature doit exister
-- quand même. L'événement est donc écrit dans la base, dans la MÊME
-- transaction que le changement métier, et l'envoi vient après.
--
-- ─── Pourquoi une table à part, et pas `emails_a_envoyer` ─────────────────
--
-- Cette table a été taillée pour un seul usage, et son schéma le dit :
--
--     bailleur_id uuid NOT NULL references bailleurs
--     unique index (bailleur_id, modele)
--
-- Le premier interdit d'écrire à un candidat. Le second — « un même palier ne
-- produit qu'un seul email par bailleur » — interdirait à un bailleur de
-- recevoir plus d'UNE notification de candidature dans toute la vie de son
-- compte. Ce n'est pas un détail à contourner : c'est la règle du cycle de
-- grâce, et elle est juste pour lui.
--
-- On pourrait rendre `bailleur_id` nullable et rendre l'index partiel. Mais la
-- fonction `avancer_cycle_de_grace` écrit `on conflict (bailleur_id, modele)`,
-- et `src/lib/abonnement.ts` supprime les rappels du cycle écoulé en comptant
-- sur cet index : le rendre partiel obligerait à rouvrir ces deux-là, validés
-- depuis longtemps, pour un besoin qui ne les concerne pas.
--
-- D'où une file dédiée, aux mêmes colonnes de service (destinataire, modèle,
-- variables, tentatives, dernière erreur) pour que le même travailleur la
-- vide de la même manière.
--
-- ─── Pourquoi un déclencheur, et pas les trois fonctions métier ───────────
--
-- `soumettre_candidature`, `repondre_candidature` et `retirer_candidature`
-- écrivent toutes dans `candidatures`. Poser l'événement dans chacune, c'est
-- trois endroits à tenir d'accord, et un quatrième chemin oublié le jour où
-- il en apparaît un.
--
-- Le déclencheur voit le fait accompli : il ne se déclenche QUE si la ligne a
-- réellement changé, après les déclencheurs de validation qui rejettent les
-- transitions interdites. Une transition refusée lève avant lui ; une
-- transition sans changement (`new.statut = old.statut`) ne l'atteint pas
-- davantage. Aucun email n'existe donc pour un geste qui n'a rien produit.
--
-- ─── Idempotence ───────────────────────────────────────────────────────────
--
-- Elle ne demande pas de clé supplémentaire, parce qu'il n'y a rien à
-- dédoublonner : une ligne de notification naît d'un changement COMMITÉ, et un
-- changement commité n'arrive qu'une fois. Cinq candidatures simultanées sur
-- la même annonce ? L'index unique de S8-A n'en laisse passer qu'une, donc le
-- déclencheur ne s'exécute qu'une fois, donc une seule notification. Deux
-- réponses simultanées ? La base en sérialise une, la seconde voit l'état
-- changé et se fait refuser par le déclencheur de transition.
--
-- Reste le rejeu de la file après incident, côté envoi : le travailleur passe
-- déjà l'identifiant de la ligne à Resend comme clé d'idempotence.

-- ─── La file ───────────────────────────────────────────────────────────────

create table public.notifications_candidature (
  id              uuid primary key default gen_random_uuid(),
  -- La candidature disparaît (annonce supprimée, compte bailleur supprimé) :
  -- ses notifications non envoyées partent avec elle. Le travailleur ne
  -- butera pas indéfiniment sur un événement qui n'a plus d'objet.
  candidature_id  uuid not null references public.candidatures (id) on delete cascade,
  evenement       text not null,
  destinataire_role text not null,
  -- L'adresse est FIGÉE au moment de l'événement, comme dans
  -- `emails_a_envoyer`. La retrouver à l'envoi obligerait le travailleur à
  -- remonter jusqu'à `auth.users`, et à décider quoi faire d'un compte entre-
  -- temps supprimé — deux responsabilités qui ne sont pas les siennes.
  destinataire    text not null,
  modele          text not null,
  variables       jsonb not null default '{}'::jsonb,
  cree_le         timestamptz not null default now(),
  envoye_le       timestamptz,
  tentatives      smallint not null default 0,
  derniere_erreur text
);

alter table public.notifications_candidature
  add constraint notifications_candidature_evenement_valide
  check (evenement in ('nouvelle', 'en_etude', 'acceptee', 'refusee', 'retiree'));

alter table public.notifications_candidature
  add constraint notifications_candidature_role_valide
  check (destinataire_role in ('bailleur', 'candidat'));

alter table public.notifications_candidature
  add constraint notifications_candidature_destinataire_non_vide
  check (length(trim(destinataire)) > 3);

alter table public.notifications_candidature
  add constraint notifications_candidature_tentatives_bornees
  check (tentatives >= 0 and tentatives <= 10);

-- L'index du travailleur : ce qui reste à envoyer, du plus ancien au plus
-- récent. Partiel, parce qu'une file vidée ne doit pas grossir l'index.
create index notifications_candidature_en_attente_idx
  on public.notifications_candidature (cree_le)
  where envoye_le is null;

create index notifications_candidature_candidature_idx
  on public.notifications_candidature (candidature_id);

alter table public.notifications_candidature enable row level security;
revoke all on public.notifications_candidature from anon, authenticated;

comment on table public.notifications_candidature is
  'File d''envoi des notifications de candidature, réservée au service_role : elle contient des adresses.';

-- ─── Qui est prévenu, et de quoi ───────────────────────────────────────────
--
-- Une seule règle, lue depuis la ligne elle-même :
--
--     candidature créée        → le bailleur de l'annonce
--     statut changé par lui    → le candidat
--     retirée (par le candidat) → le bailleur
--
-- Le candidat n'est jamais prévenu de son propre retrait, et le bailleur
-- jamais de sa propre réponse.
--
-- Les variables ne portent que ce que l'email a le droit de dire : le nom du
-- candidat, ce que Find publie déjà de l'annonce, et de quoi construire le
-- lien. Ni téléphone, ni adresse de l'autre partie, ni identifiant de compte.

create or replace function prive.notifier_candidature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_annonce       public.annonces%rowtype;
  v_email_bailleur text;
  v_email_candidat text;
  v_nom_candidat  text;
  v_evenement     text;
  v_public        jsonb;
begin
  -- Un statut inchangé n'est pas un événement.
  if tg_op = 'UPDATE' and new.statut is not distinct from old.statut then
    return null;
  end if;

  select * into v_annonce from public.annonces a where a.id = new.annonce_id;
  if not found then return null; end if;

  -- Ce que Find publie déjà : rien de plus n'entre dans un email.
  v_public := jsonb_build_object(
    'reference', v_annonce.reference,
    'type', v_annonce.type,
    'ville', v_annonce.ville,
    'quartier', v_annonce.quartier,
    'annonce_id', v_annonce.id
  );

  select nom into v_nom_candidat from public.candidats c where c.id = new.candidat_id;

  if tg_op = 'INSERT' then
    v_evenement := 'nouvelle';
  else
    v_evenement := new.statut::text;
  end if;

  -- ── Vers le bailleur : une candidature arrive, ou s'en va ────────────
  if v_evenement in ('nouvelle', 'retiree') then
    select u.email into v_email_bailleur
      from auth.users u where u.id = v_annonce.bailleur_id;
    if v_email_bailleur is null then return null; end if;

    insert into public.notifications_candidature
      (candidature_id, evenement, destinataire_role, destinataire, modele, variables)
    values (
      new.id, v_evenement, 'bailleur', v_email_bailleur,
      case v_evenement when 'nouvelle' then 'candidature_recue' else 'candidature_retiree' end,
      v_public || jsonb_build_object('candidat_nom', coalesce(v_nom_candidat, ''))
    );
    return null;
  end if;

  -- ── Vers le candidat : le bailleur a répondu ─────────────────────────
  --
  -- `candidat_id` à NULL : le compte a été supprimé. Il n'y a personne à
  -- prévenir, et aucune adresse à retrouver — l'événement ne s'écrit pas.
  if new.candidat_id is null then return null; end if;

  select u.email into v_email_candidat
    from auth.users u where u.id = new.candidat_id;
  if v_email_candidat is null then return null; end if;

  insert into public.notifications_candidature
    (candidature_id, evenement, destinataire_role, destinataire, modele, variables)
  values (
    new.id, v_evenement, 'candidat', v_email_candidat,
    'candidature_' || v_evenement,
    v_public || jsonb_build_object('candidat_nom', coalesce(v_nom_candidat, ''))
  );
  return null;
end;
$$;

create trigger notifier_candidature
  after insert or update of statut on public.candidatures
  for each row execute function prive.notifier_candidature();

-- ─── Un candidat supprime son compte ───────────────────────────────────────
--
-- S8-A coupe le lien sans effacer la candidature : `candidat_id` passe à NULL.
-- La règle retenue ici est l'ANNULATION des notifications qui ne sont pas
-- encore parties vers lui : écrire à quelqu'un qui vient de supprimer son
-- compte serait le contraire de ce qu'il a demandé.
--
-- Celles qui sont DÉJÀ parties restent dans la file, marquées envoyées : c'est
-- l'histoire de ce qui s'est passé, et la réécrire n'effacerait rien.
--
-- Les notifications vers le BAILLEUR ne sont pas touchées : elles portent sur
-- son annonce, et le nom du candidat y était figé au moment des faits.

create or replace function prive.annuler_notifications_candidat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.candidat_id is not null and new.candidat_id is null then
    delete from public.notifications_candidature n
     where n.candidature_id = new.id
       and n.destinataire_role = 'candidat'
       and n.envoye_le is null;
  end if;
  return null;
end;
$$;

create trigger annuler_notifications_candidat
  after update of candidat_id on public.candidatures
  for each row execute function prive.annuler_notifications_candidat();
