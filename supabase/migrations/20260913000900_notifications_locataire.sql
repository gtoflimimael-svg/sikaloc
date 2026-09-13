-- ═══════════════════════════════════════════════════════════════════════════
-- Un locataire peut demander à ne plus recevoir d'email
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Pourquoi cette colonne existe ─────────────────────────────────────────
--
-- Sikaloc_Pro gagne deux boutons qui envoient un email à un locataire : sa
-- quittance, et la relance d'un loyer en retard. Ce sont des messages
-- contractuels, pas de la prospection — mais une personne qui reçoit un
-- message doit pouvoir le faire cesser, et lui répondre « demandez à votre
-- bailleur » serait lui refuser un droit qui est le sien.
--
-- Le bailleur, lui, garde `bailleurs.notif_email` : les deux réglages sont
-- séparés parce que les deux personnes le sont.
alter table public.locataires
  add column if not exists notif_email boolean not null default true;

comment on column public.locataires.notif_email is
  'Ce locataire accepte-t-il les emails de Sikaloc — quittance, relance ? Vrai par défaut. Les envois automatiques comme les envois déclenchés par le bailleur le respectent.';

-- ═══ La première écriture de Sikaloc_Me ═════════════════════════════════════
--
-- ─── Une correction à apporter à la migration 20260913000700 ───────────────
--
-- Elle affirmait, en toutes lettres : « Aucun `insert`, aucun `update`, aucun
-- `delete` […] Sikaloc_Me montre ; c'est Sikaloc_Pro qui écrit. » Ce n'est plus
-- exact à partir d'ici, et le dire vaut mieux que laisser un commentaire périmé
-- faire autorité dans un fichier de sécurité.
--
-- Ce qui reste vrai, et qui était le vrai propos : un locataire ne touche à
-- AUCUNE donnée métier. Ni un paiement, ni un loyer, ni un bail, ni une
-- quittance. La seule chose qu'il peut écrire est la réponse à une question qui
-- ne concerne que lui : « voulez-vous recevoir ces messages ? »
--
-- ─── Pourquoi une fonction plutôt qu'une politique `update` ────────────────
--
-- Une politique d'UPDATE sur `locataires` demanderait un `grant update` — même
-- restreint à une colonne, elle ouvrirait la table à un rôle qui n'y a
-- aujourd'hui aucun droit, et il faudrait relire les deux politiques existantes
-- pour s'assurer qu'elles n'en deviennent pas contournables.
--
-- Une fonction ne donne accès à rien d'autre qu'à elle-même. La surface exposée
-- se lit en une ligne : un booléen, sur ses propres fiches.
create or replace function public.definir_mes_notifications(p_actif boolean)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.locataires
     set notif_email = coalesce(p_actif, true)
   where id in (select prive.fiches_du_compte());
$$;

comment on function public.definir_mes_notifications(boolean) is
  'Le locataire appelant accepte, ou refuse, les emails de Sikaloc. Écrit la seule colonne notif_email, et seulement sur ses propres fiches. Unique chemin d''écriture de Sikaloc_Me.';

revoke all on function public.definir_mes_notifications(boolean) from public, anon;
grant execute on function public.definir_mes_notifications(boolean) to authenticated;

-- ═══ Et la lecture qui va avec ══════════════════════════════════════════════
--
-- `bool_and` et pas `bool_or` : une même personne peut avoir deux fiches, une
-- par bailleur. Le réglage ci-dessus les écrit toutes ensemble, donc elles ne
-- divergent pas par l'usage — mais si jamais elles divergeaient, la réponse
-- prudente est le silence, pas l'envoi. On ne se trompe pas dans le sens qui
-- écrit à quelqu'un qui a demandé qu'on s'arrête.
--
-- `coalesce(…, true)` couvre le cas sans aucune fiche : l'agrégat vaudrait NULL
-- là où l'écran attend un booléen.
create or replace function public.mes_preferences()
returns table (notif_email boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_and(l.notif_email), true)
    from public.locataires l
   where l.id in (select prive.fiches_du_compte());
$$;

comment on function public.mes_preferences() is
  'Les préférences de notification du locataire appelant. Ne rend rien d''autre.';

revoke all on function public.mes_preferences() from public, anon;
grant execute on function public.mes_preferences() to authenticated;
