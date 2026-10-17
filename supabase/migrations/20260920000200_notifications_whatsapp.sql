-- ═══════════════════════════════════════════════════════════════════════════
-- Sikaloc_Find, S8-F — WhatsApp, second canal des notifications de candidature
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Une file à part, pas un mélange ───────────────────────────────────────
--
-- S8-D a posé `notifications_candidature` : la file EMAIL, drainée par
-- `/api/cron/notifications`, éprouvée par 119 vérifications. On n'y touche pas.
--
-- WhatsApp reçoit sa PROPRE file, `notifications_whatsapp`, aux mêmes colonnes
-- de service. C'est le choix « Option 2 » : deux files spécialisées plutôt
-- qu'une table de livraisons. La raison est la règle cardinale de S8-F —
-- un échec WhatsApp doit être indépendant d'un échec email. Deux lignes
-- distinctes, deux compteurs de tentatives, deux dernières erreurs : l'une
-- peut échouer dix fois sans que l'autre le sache. C'est déjà le rapport
-- qu'entretiennent `emails_a_envoyer` et `notifications_candidature`.
--
-- ─── Le consentement, et son asymétrie assumée ─────────────────────────────
--
-- Le BAILLEUR a déjà tout ce qu'il faut : `notif_whatsapp` (défaut vrai) et un
-- téléphone VÉRIFIÉ (`telephone_verifie_le`, canal SMS/WHATSAPP/ADMIN). On lui
-- envoie un WhatsApp s'il est vérifié ET qu'il n'a pas coupé le canal.
--
-- Le CANDIDAT n'a rien de tel : son numéro est canonisé mais jamais vérifié,
-- et il n'a jamais consenti à un WhatsApp. « Numéro présent = consentement »
-- serait précisément l'écueil que S8-F interdit. On introduit donc un
-- consentement EXPLICITE, `candidats.notif_whatsapp`, défaut FAUX : opt-in, et
-- non opt-out comme le bailleur — parce qu'il n'a jamais dit oui.
--
-- Reste que le numéro du candidat n'est pas vérifié. C'est une garantie plus
-- faible que côté bailleur, nommée comme telle : la vérification du téléphone
-- candidat est le préalable recommandé avant tout envoi réel (voir le rapport
-- S8-F, « points ouverts »). Aucun fournisseur réel n'étant branché à cette
-- étape, rien ne part en vrai de toute façon.

-- ─── Le consentement candidat ──────────────────────────────────────────────

alter table public.candidats
  add column if not exists notif_whatsapp boolean not null default false;

comment on column public.candidats.notif_whatsapp is
  'Le candidat accepte d''être prévenu par WhatsApp. Opt-in explicite (défaut faux) : '
  'contrairement au bailleur, son numéro n''est pas vérifié et il n''a jamais consenti par défaut.';

-- ─── À qui l'on peut écrire, et à quel numéro ──────────────────────────────
--
-- Deux fonctions, une par rôle, qui rendent le NUMÉRO canonique éligible ou
-- NULL. Elles sont la source unique de la règle d'éligibilité : le déclencheur
-- ne fait que les appeler. `telephone_canonique` garantit un `+229…` valide,
-- ou NULL — jamais un numéro inventé.

create or replace function prive.whatsapp_du_bailleur(p_bailleur uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select prive.telephone_canonique(b.telephone)
  from public.bailleurs b
  where b.id = p_bailleur
    and b.telephone_verifie_le is not null   -- numéro vérifié
    and b.notif_whatsapp                       -- canal non coupé
    and prive.telephone_canonique(b.telephone) is not null;
$$;

create or replace function prive.whatsapp_du_candidat(p_candidat uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select prive.telephone_canonique(c.telephone)
  from public.candidats c
  where c.id = p_candidat
    and c.notif_whatsapp                       -- opt-in explicite
    and prive.telephone_canonique(c.telephone) is not null;
$$;

-- ─── La file WhatsApp ──────────────────────────────────────────────────────
--
-- Mêmes colonnes de service que `notifications_candidature`, pour que le même
-- travailleur la vide de la même manière. `destinataire` porte ici le NUMÉRO
-- (au format `+229…`), figé au moment de l'événement — jamais retrouvé à
-- l'envoi, comme pour l'email.

create table public.notifications_whatsapp (
  id                uuid primary key default gen_random_uuid(),
  candidature_id    uuid not null references public.candidatures (id) on delete cascade,
  evenement         text not null,
  destinataire_role text not null,
  destinataire      text not null,
  modele            text not null,
  variables         jsonb not null default '{}'::jsonb,
  cree_le           timestamptz not null default now(),
  envoye_le         timestamptz,
  tentatives        smallint not null default 0,
  derniere_erreur   text
);

alter table public.notifications_whatsapp
  add constraint notifications_whatsapp_evenement_valide
  check (evenement in ('nouvelle', 'en_etude', 'acceptee', 'refusee', 'retiree'));

alter table public.notifications_whatsapp
  add constraint notifications_whatsapp_role_valide
  check (destinataire_role in ('bailleur', 'candidat'));

-- Un `+229` suivi de dix chiffres : ce que `telephone_canonique` produit, et
-- rien d'autre. La file ne portera jamais un numéro mal formé.
alter table public.notifications_whatsapp
  add constraint notifications_whatsapp_destinataire_canonique
  check (destinataire ~ '^\+229[0-9]{10}$');

alter table public.notifications_whatsapp
  add constraint notifications_whatsapp_tentatives_bornees
  check (tentatives >= 0 and tentatives <= 10);

create index notifications_whatsapp_en_attente_idx
  on public.notifications_whatsapp (cree_le)
  where envoye_le is null;

create index notifications_whatsapp_candidature_idx
  on public.notifications_whatsapp (candidature_id);

alter table public.notifications_whatsapp enable row level security;
revoke all on public.notifications_whatsapp from anon, authenticated;

comment on table public.notifications_whatsapp is
  'File d''envoi des notifications WhatsApp, réservée au service_role : elle contient des numéros.';

-- ─── Le déclencheur : email TOUJOURS, WhatsApp SI éligible ─────────────────
--
-- On étend `notifier_candidature` (S8-D). La file email est alimentée
-- exactement comme avant. En plus, et seulement si le destinataire est
-- éligible, une ligne WhatsApp est écrite — dans la MÊME transaction que
-- l'événement métier, comme l'email. Un destinataire non éligible ne produit
-- pas de ligne WhatsApp, et c'est tout : l'email, lui, part quand même.

create or replace function prive.notifier_candidature()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_annonce        public.annonces%rowtype;
  v_email_bailleur text;
  v_email_candidat text;
  v_tel_bailleur   text;
  v_tel_candidat   text;
  v_nom_candidat   text;
  v_evenement      text;
  v_public         jsonb;
  v_variables      jsonb;
begin
  if tg_op = 'UPDATE' and new.statut is not distinct from old.statut then
    return null;
  end if;

  select * into v_annonce from public.annonces a where a.id = new.annonce_id;
  if not found then return null; end if;

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

  -- ── Vers le bailleur ─────────────────────────────────────────────────
  if v_evenement in ('nouvelle', 'retiree') then
    v_variables := v_public || jsonb_build_object('candidat_nom', coalesce(v_nom_candidat, ''));

    select u.email into v_email_bailleur
      from auth.users u where u.id = v_annonce.bailleur_id;
    if v_email_bailleur is not null then
      insert into public.notifications_candidature
        (candidature_id, evenement, destinataire_role, destinataire, modele, variables)
      values (
        new.id, v_evenement, 'bailleur', v_email_bailleur,
        case v_evenement when 'nouvelle' then 'candidature_recue' else 'candidature_retiree' end,
        v_variables
      );
    end if;

    v_tel_bailleur := prive.whatsapp_du_bailleur(v_annonce.bailleur_id);
    if v_tel_bailleur is not null then
      insert into public.notifications_whatsapp
        (candidature_id, evenement, destinataire_role, destinataire, modele, variables)
      values (
        new.id, v_evenement, 'bailleur', v_tel_bailleur,
        case v_evenement when 'nouvelle' then 'candidature_recue' else 'candidature_retiree' end,
        v_variables
      );
    end if;
    return null;
  end if;

  -- ── Vers le candidat ─────────────────────────────────────────────────
  if new.candidat_id is null then return null; end if;
  v_variables := v_public || jsonb_build_object('candidat_nom', coalesce(v_nom_candidat, ''));

  select u.email into v_email_candidat
    from auth.users u where u.id = new.candidat_id;
  if v_email_candidat is not null then
    insert into public.notifications_candidature
      (candidature_id, evenement, destinataire_role, destinataire, modele, variables)
    values (
      new.id, v_evenement, 'candidat', v_email_candidat,
      'candidature_' || v_evenement, v_variables
    );
  end if;

  v_tel_candidat := prive.whatsapp_du_candidat(new.candidat_id);
  if v_tel_candidat is not null then
    insert into public.notifications_whatsapp
      (candidature_id, evenement, destinataire_role, destinataire, modele, variables)
    values (
      new.id, v_evenement, 'candidat', v_tel_candidat,
      'candidature_' || v_evenement, v_variables
    );
  end if;
  return null;
end;
$$;

-- ─── Le compte candidat disparaît : annuler les WhatsApp non envoyés ───────
--
-- La règle de S8-D, étendue au second canal. On complète `annuler_notifications
-- _candidat` pour vider aussi la file WhatsApp des messages non partis vers ce
-- candidat. Les WhatsApp déjà envoyés restent, comme les emails.

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
    delete from public.notifications_whatsapp w
     where w.candidature_id = new.id
       and w.destinataire_role = 'candidat'
       and w.envoye_le is null;
  end if;
  return null;
end;
$$;
