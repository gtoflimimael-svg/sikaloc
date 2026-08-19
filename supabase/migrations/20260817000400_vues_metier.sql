-- =============================================================================
-- Sikaloc — Vues métier
--
-- `security_invoker = true` est indispensable : sans lui, une vue s'exécute
-- avec les droits de son créateur et court-circuite silencieusement toutes les
-- policies RLS définies plus haut.
-- =============================================================================

-- ─── Détection des impayés (§6.1.8) ─────────────────────────────────────────
--
-- L'algorithme de la spécification évalue le mois en cours. Il est ici étendu à
-- tous les mois écoulés depuis le début du bail : l'écran des impayés demande
-- un tri « par ancienneté, plus ancien en haut », ce qui suppose de pouvoir
-- remonter plusieurs mois de retard, pas seulement le mois courant.
--
-- La comparaison porte sur la SOMME des paiements validés de la période, et non
-- sur un paiement isolé : deux versements partiels qui totalisent le loyer
-- soldent la période.

create view public.v_impayes with (security_invoker = true) as
with periodes as (
  select
    b.id                as bail_id,
    b.bailleur_id,
    b.locataire_id,
    b.logement_id,
    b.loyer_mensuel,
    b.jour_echeance::int as jour_echeance,
    b.tolerance_jours::int as tolerance_jours,
    serie::date         as periode_debut
  from public.baux b
  -- Cast explicite en timestamp : sans lui, date_trunc résout vers la
  -- surcharge timestamptz et la reconversion en date dépendrait du fuseau de
  -- la session — une période de loyer pourrait basculer d'un mois.
  cross join lateral generate_series(
    date_trunc('month', b.date_debut::timestamp),
    date_trunc(
      'month',
      least(current_date, coalesce(b.date_fin, current_date))::timestamp
    ),
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
  coalesce(regle.montant_paye, 0)                        as montant_paye,
  e.loyer_mensuel - coalesce(regle.montant_paye, 0)      as montant_du,
  (current_date - e.date_echeance)::int                  as jours_de_retard,
  locataire.nom                                          as locataire_nom,
  locataire.telephone                                    as locataire_telephone,
  logement.adresse                                       as logement_adresse,
  logement.ville                                         as logement_ville
from echeances e
join public.locataires locataire on locataire.id = e.locataire_id
join public.logements  logement  on logement.id  = e.logement_id
left join lateral (
  select sum(pa.montant) as montant_paye
    from public.paiements pa
   where pa.bail_id       = e.bail_id
     and pa.statut        = 'Validé'
     and pa.type_paiement = 'Loyer'
     and pa.periode_debut = e.periode_debut
) regle on true
where current_date > e.date_echeance + e.tolerance_jours
  and coalesce(regle.montant_paye, 0) < e.loyer_mensuel;

comment on view public.v_impayes is
  'Loyers en retard, une ligne par (bail, mois). Tolérance de grâce appliquée.';

-- ─── Métriques du tableau de bord (§6.1.3) ──────────────────────────────────

create view public.v_metriques_dashboard with (security_invoker = true) as
select
  b.id as bailleur_id,

  (select count(*)
     from public.logements l
    where l.bailleur_id = b.id) as nb_logements,

  (select count(*)
     from public.baux ba
    where ba.bailleur_id = b.id
      and ba.statut = 'Actif') as nb_baux_actifs,

  -- Taux d'occupation : (baux actifs / logements) × 100.
  case
    when (select count(*) from public.logements l where l.bailleur_id = b.id) = 0
    then 0::numeric
    else round(
      (select count(*) from public.baux ba
        where ba.bailleur_id = b.id and ba.statut = 'Actif')::numeric
      * 100
      / (select count(*) from public.logements l where l.bailleur_id = b.id)::numeric,
      1
    )
  end as taux_occupation,

  -- Loyers attendus : baux actifs couvrant le mois en cours.
  coalesce((
    select sum(ba.loyer_mensuel)
      from public.baux ba
     where ba.bailleur_id = b.id
       and ba.statut = 'Actif'
       and date_trunc('month', ba.date_debut::timestamp)
           <= date_trunc('month', current_date::timestamp)
       and (ba.date_fin is null
            or ba.date_fin >= date_trunc('month', current_date::timestamp)::date)
  ), 0) as loyers_attendus_mois,

  -- Loyers perçus pour la période du mois en cours (et non « encaissés ce
  -- mois ») : c'est ce qui rend le ratio de recouvrement comparable.
  coalesce((
    select sum(pa.montant)
      from public.paiements pa
     where pa.bailleur_id  = b.id
       and pa.statut       = 'Validé'
       and pa.type_paiement = 'Loyer'
       and pa.periode_debut = date_trunc('month', current_date::timestamp)::date
  ), 0) as loyers_percus_mois,

  -- Chiffre d'affaires : tout ce qui a été encaissé pendant le mois calendaire.
  coalesce((
    select sum(pa.montant)
      from public.paiements pa
     where pa.bailleur_id = b.id
       and pa.statut      = 'Validé'
       and pa.date_paiement >= date_trunc('month', current_date::timestamp)::date
       and pa.date_paiement <
           (date_trunc('month', current_date::timestamp) + interval '1 month')::date
  ), 0) as ca_du_mois,

  (select count(*)
     from public.v_impayes i
    where i.bailleur_id = b.id) as nb_impayes,

  coalesce((
    select sum(i.montant_du)
      from public.v_impayes i
     where i.bailleur_id = b.id
  ), 0) as montant_impaye_total

from public.bailleurs b;

comment on view public.v_metriques_dashboard is
  'Quatre métriques temps réel du tableau de bord + agrégats de contexte.';

-- ─── Privilèges ─────────────────────────────────────────────────────────────

revoke all on public.v_impayes              from anon;
revoke all on public.v_metriques_dashboard  from anon;

grant select on public.v_impayes             to authenticated;
grant select on public.v_metriques_dashboard to authenticated;
