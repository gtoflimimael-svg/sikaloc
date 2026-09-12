-- ═══════════════════════════════════════════════════════════════════════════
-- Une échéance passée n'est pas une échéance impayée
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ─── Ce que Sikaloc affirmait, et qui était faux ───────────────────────────
--
-- Un bail de janvier à décembre 2026, enregistré en septembre, produisait huit
-- loyers « en retard » — de février à septembre. Le bailleur n'avait pourtant
-- rien dit de ces mois : il avait très probablement encaissé la plupart avant
-- même de connaître Sikaloc.
--
-- Le raisonnement tenait en une ligne : « aucun paiement enregistré pour cette
-- période + échéance dépassée = impayé ». Il oubliait une troisième
-- possibilité, la plus fréquente : le loyer a été payé, simplement pas ici.
--
-- Ce n'est pas un détail d'affichage. L'écran des impayés est celui d'où l'on
-- relance un locataire par WhatsApp. Réclamer un loyer déjà versé abîme une
-- relation que le produit est censé protéger.
--
-- ─── La règle qui remplace ─────────────────────────────────────────────────
--
--     échéance dépassée + rien d'enregistré + le bailleur s'est prononcé
--         → Impayé
--
--     échéance dépassée + rien d'enregistré + le bailleur ne s'est pas prononcé
--         → À déterminer, et surtout PAS impayé
--
-- La date du bail sert à savoir quelles échéances examiner. Elle ne suffit
-- jamais à décider de leur état.
--
-- ─── Ce qui n'est pas touché ───────────────────────────────────────────────
--
-- La règle d'échéance elle-même. Elle reste ce qu'elle était : le jour
-- `jour_echeance` du mois, ramené au dernier jour pour les mois plus courts,
-- plus `tolerance_jours` de grâce. Un mois écoulé n'est pas une échéance échue,
-- et c'est cette règle-là — pas une comparaison de mois — qui en décide.
--
-- Les paiements partiels non plus : la somme des versements validés de la
-- période est comparée au loyer, et deux versements qui totalisent le loyer
-- soldent le mois. Inchangé.

-- ── Le bailleur s'est-il prononcé sur l'avant-Sikaloc ? ────────────────────
--
-- Une seule marque par bail, pas un état par mois. Le parcours de déclaration
-- fait le tour de toutes les échéances antérieures d'un coup : à sa sortie,
-- aucune ne reste sans réponse. Un état par mois aurait décrit une situation
-- qui ne peut pas exister.
alter table public.baux
  add column if not exists historique_declare_le timestamptz,
  add column if not exists historique_declare_par uuid references public.bailleurs(id);

comment on column public.baux.historique_declare_le is
  'Moment où le bailleur s''est prononcé sur les échéances antérieures à l''enregistrement. NULL = pas encore ; ces échéances sont alors « À déterminer », jamais « Impayé ».';
comment on column public.baux.historique_declare_par is
  'Qui a déclaré l''historique. Trace d''audit : une déclaration de règlement est une affirmation financière.';

-- ── Un loyer réglé avant Sikaloc ───────────────────────────────────────────
--
-- Représenté par un paiement ordinaire, et c'est voulu : il n'y a qu'une seule
-- façon de savoir qu'une période est réglée, et c'est un paiement. Inventer une
-- seconde table d'« échéances réglées » aurait créé deux vérités qui auraient
-- fini par diverger.
--
-- Le drapeau ne change pas la nature du paiement, il dit d'où il vient.
alter table public.paiements
  add column if not exists historique boolean not null default false;

comment on column public.paiements.historique is
  'Vrai : loyer déclaré comme réglé AVANT l''usage de Sikaloc. Le montant est réel, mais Sikaloc n''a pas assisté à l''encaissement — aucune quittance n''est émise pour ces paiements.';

-- ── La date d'un paiement peut être inconnue ───────────────────────────────
--
-- « Janvier est réglé » ne dit pas quel jour. Écrire la date du jour serait
-- affirmer un encaissement qui n'a pas eu lieu ce jour-là, et cette date
-- s'imprime sur une quittance. Écrire la date d'échéance ne vaut pas mieux :
-- c'est la date où le loyer était dû, pas celle où il a été versé.
--
-- La colonne accepte donc NULL. Le bailleur qui connaît la date peut toujours
-- la donner — c'est déjà possible aujourd'hui, et ça le reste.
alter table public.paiements
  alter column date_paiement drop not null;

comment on column public.paiements.date_paiement is
  'Jour de l''encaissement. NULL uniquement pour un paiement historique dont la date réelle n''est pas connue — jamais une date inventée.';

-- Une date inconnue n'est admise que pour un paiement historique : partout
-- ailleurs, elle reste obligatoire.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'paiements_date_connue_sauf_historique') then
    alter table public.paiements
      add constraint paiements_date_connue_sauf_historique check (
        date_paiement is not null or historique is true
      );
  end if;
end
$$;

-- ═══ L'état de chaque échéance ══════════════════════════════════════════════
--
-- Une seule vue calcule tout — `v_impayes` n'en est plus qu'une sélection.
-- Deux calculs parallèles auraient fini par ne plus dire la même chose.
--
-- Quatre états, et la nuance qui manquait :
--
--     Réglé          la somme des versements validés couvre le loyer
--     À venir        l'échéance n'est pas encore dépassée, tolérance comprise
--     À déterminer   échéance antérieure à l'enregistrement, non déclarée
--     Impayé         tout le reste
create or replace view public.v_echeances with (security_invoker = true) as
with periodes as (
  select
    b.id                   as bail_id,
    b.bailleur_id,
    b.locataire_id,
    b.logement_id,
    b.loyer_mensuel,
    b.jour_echeance::int   as jour_echeance,
    b.tolerance_jours::int as tolerance_jours,
    b.created_at::date     as enregistre_le,
    b.historique_declare_le,
    serie::date            as periode_debut
  from public.baux b
  -- Cast explicite en timestamp : sans lui, date_trunc résout vers la
  -- surcharge timestamptz et la reconversion en date dépendrait du fuseau de
  -- la session — une période de loyer pourrait basculer d'un mois.
  --
  -- La série va jusqu'à la fin du bail, et non jusqu'à aujourd'hui comme
  -- auparavant : c'est ce qui permet de montrer les mois « À venir ». Un bail
  -- sans date de fin s'arrête à aujourd'hui, faute de fin à énumérer.
  cross join lateral generate_series(
    date_trunc('month', b.date_debut::timestamp),
    date_trunc('month', coalesce(b.date_fin, current_date)::timestamp),
    interval '1 month'
  ) as serie
  where b.statut = 'Actif'
),
echeances as (
  select
    p.*,
    (p.periode_debut + interval '1 month' - interval '1 day')::date as periode_fin,
    -- Un jour d'échéance au 31 tombe au 28/29/30 pour les mois plus courts.
    make_date(
      extract(year  from p.periode_debut)::int,
      extract(month from p.periode_debut)::int,
      least(
        p.jour_echeance,
        extract(day from (p.periode_debut + interval '1 month' - interval '1 day'))::int
      )
    ) as date_echeance
  from periodes p
)
select
  e.bail_id,
  e.bailleur_id,
  e.locataire_id,
  e.logement_id,
  e.periode_debut,
  e.periode_fin,
  e.date_echeance,
  e.loyer_mensuel,
  e.tolerance_jours,
  coalesce(regle.montant_paye, 0)                   as montant_paye,
  e.loyer_mensuel - coalesce(regle.montant_paye, 0) as montant_du,
  (current_date - e.date_echeance)::int             as jours_de_retard,

  -- L'échéance était-elle déjà échue quand le bail a été enregistré ? C'est la
  -- définition de « antérieure à Sikaloc » — fondée sur la règle d'échéance du
  -- bail, pas sur une comparaison de mois.
  (e.date_echeance + e.tolerance_jours < e.enregistre_le) as anterieure,
  (e.historique_declare_le is not null)                   as historique_declare,

  case
    when coalesce(regle.montant_paye, 0) >= e.loyer_mensuel then 'Réglé'
    when current_date <= e.date_echeance + e.tolerance_jours then 'À venir'
    when e.date_echeance + e.tolerance_jours < e.enregistre_le
         and e.historique_declare_le is null then 'À déterminer'
    else 'Impayé'
  end as etat,

  locataire.nom       as locataire_nom,
  locataire.telephone as locataire_telephone,
  logement.adresse    as logement_adresse,
  logement.ville      as logement_ville
from echeances e
join public.locataires locataire on locataire.id = e.locataire_id
join public.logements  logement  on logement.id  = e.logement_id
left join lateral (
  -- La SOMME des versements validés de la période, et non un paiement isolé :
  -- deux versements partiels qui totalisent le loyer soldent le mois.
  select sum(pa.montant) as montant_paye
    from public.paiements pa
   where pa.bail_id       = e.bail_id
     and pa.statut        = 'Validé'
     and pa.type_paiement = 'Loyer'
     and pa.periode_debut = e.periode_debut
) regle on true;

comment on view public.v_echeances is
  'Une ligne par (bail actif, mois), avec son état : Réglé, À venir, À déterminer, Impayé. Source unique du calcul ; v_impayes en est une sélection.';

-- ── Les impayés, dérivés et non recalculés ────────────────────────────────
--
-- Mêmes colonnes qu'avant, dans le même ordre : aucun appelant ne change.
-- Seule la provenance change, et avec elle la disparition des échéances
-- antérieures sur lesquelles personne ne s'est prononcé.
create or replace view public.v_impayes with (security_invoker = true) as
select
  bail_id,
  bailleur_id,
  locataire_id,
  logement_id,
  periode_debut,
  periode_fin,
  date_echeance,
  loyer_mensuel,
  tolerance_jours,
  montant_paye,
  montant_du,
  jours_de_retard,
  locataire_nom,
  locataire_telephone,
  logement_adresse,
  logement_ville
from public.v_echeances
where etat = 'Impayé';

comment on view public.v_impayes is
  'Loyers en retard, une ligne par (bail, mois). Sélection de v_echeances : une échéance antérieure à l''enregistrement n''y figure que si le bailleur s''est prononcé.';

grant select on public.v_echeances to authenticated;

-- ── Les baux déjà enregistrés ─────────────────────────────────────────────
--
-- Aucune donnée n'est touchée. `historique_declare_le` reste NULL pour tous, ce
-- qui est la vérité : personne n'a jamais été interrogé sur ces mois. Leurs
-- échéances antérieures quittent donc l'écran des impayés — non pas effacées,
-- mais rendues à leur état réel, « À déterminer ».
--
-- Les paiements déjà saisis restent tels quels, `historique = false`, parce
-- qu'ils ont bien été enregistrés dans Sikaloc au moment où ils l'ont été.
-- Les requalifier après coup serait réécrire l'histoire.
--
-- Le bailleur retrouve chaque bail concerné depuis sa fiche, avec une invite à
-- renseigner l'historique quand il le souhaite.
