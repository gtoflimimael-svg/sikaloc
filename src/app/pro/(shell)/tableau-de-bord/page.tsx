import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowRight, Banknote, Check, House, ReceiptText, TriangleAlert } from 'lucide-react'

import { ReprendreVisite } from '@/components/app/reprendre-visite'
import { CarteMetrique } from '@/components/app/carte-metrique'
import { Alerte, EnTetePage } from '@/components/ui/retours'
import { TableauListe } from '@/components/ui/listes'
import { bailleurOnboarde } from '@/lib/session'
import { avancement, ouvertureAutomatique } from '@/lib/visite/etapes'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Echeance, Impaye, MetriquesDashboard, StatutAnnonce } from '@/lib/types/database'
import { compterEtapesConfigurees, determinerActionContextuelleDashboard, determinerActionPrincipaleDemarrage, determinerEtatDashboardPro, periodeCouranteDashboard, peutCreerBail, presenterRecouvrementDashboard } from '@/lib/dashboard/etat'
import { formaterDateCourte, formaterFCFA, formaterPeriode } from '@/lib/format'

export const metadata: Metadata = { title: { absolute: 'Tableau de bord · Sikaloc Pro' } }

type LogementDashboard = {
  id: string
  adresse: string
  type: string
  ville: string
  baux: { id: string; statut: string }[] | null
  annonces: { id: string; statut: StatutAnnonce }[] | null
}

type PaiementDashboard = {
  id: string
  montant: number
  date_paiement: string | null
  periode_debut: string
  statut: string
  mode_paiement: string
  bail: { locataire?: { nom?: string } | { nom?: string }[] } | null
  quittance: { id: string; type: string } | { id: string; type: string }[] | null
}

type PaiementBrouillonDashboard = {
  id: string
  montant: number
  periode_debut: string
  type_paiement: string
  bail: { locataire?: { nom?: string } | { nom?: string }[] } | null
}

type EcheanceDashboard = Pick<
  Echeance,
  'bail_id' | 'periode_debut' | 'date_echeance' | 'montant_du' | 'locataire_nom' | 'logement_adresse'
>

type ImpayeDashboard = Pick<
  Impaye,
  'bail_id' | 'periode_debut' | 'montant_du' | 'jours_de_retard' | 'locataire_nom' | 'logement_adresse'
>

function logementOccupe(logement: LogementDashboard) {
  return logement.baux?.some((bail) => bail.statut === 'Actif') ?? false
}

function annonceVivante(logement: LogementDashboard) {
  return logement.annonces?.find((annonce) => annonce.statut !== 'cloturee')
}

function nomLocataire(
  bail: { locataire?: { nom?: string } | { nom?: string }[] } | null | undefined,
) {
  const locataire = Array.isArray(bail?.locataire) ? bail.locataire[0] : bail?.locataire
  return locataire?.nom ?? 'Locataire'
}

function documentPaiement(
  quittance: PaiementDashboard['quittance'],
): { id: string; type: string } | null {
  return Array.isArray(quittance) ? quittance[0] ?? null : quittance
}

function LienJustificatifPaiement({ paiement }: { paiement: PaiementDashboard }) {
  const document = documentPaiement(paiement.quittance)
  if (!document) return null

  return (
    <Link
      href={`/pro/quittances/${encodeURIComponent(document.id)}`}
      className="dashboard-payment-document"
      aria-label={`Voir ${document.type.toLowerCase()} — ${nomLocataire(paiement.bail)}, ${formaterPeriode(paiement.periode_debut)}`}
    >
      Voir le justificatif
    </Link>
  )
}

function SyntheseRecouvrement({
  recouvrement,
  periode,
}: {
  recouvrement: NonNullable<ReturnType<typeof presenterRecouvrementDashboard>>
  periode: string
}) {
  const { attendu, valide, taux, progression, excedent } = recouvrement
  const libellePeriode = formaterPeriode(periode)
  const description = attendu === 0
    ? valide > 0
      ? 'Des loyers ont été validés, sans montant attendu sur cette période.'
      : 'Aucun loyer attendu sur cette période.'
    : excedent > 0
      ? `Tous les loyers attendus sont couverts · ${formaterFCFA(excedent)} au-delà du montant attendu.`
      : taux === 100
        ? 'Tous les loyers attendus sont validés.'
        : taux === 0
          ? 'Aucun paiement validé sur les loyers attendus.'
          : 'des loyers attendus sont validés.'

  return (
    <section className="dashboard-collection" aria-labelledby="recouvrement-mois">
      <p className="dashboard-eyebrow">Recouvrement · {libellePeriode}</p>
      <div className="dashboard-collection-heading">
        <div>
          <h2 id="recouvrement-mois" className="dashboard-collection-title">
            {taux === null ? '—' : `${taux} %`}
          </h2>
          <p className="dashboard-collection-caption">{description}</p>
        </div>
        <div className="dashboard-collection-totals" aria-label={`Montants de ${libellePeriode}`}>
          <div>
            <span>Validé</span>
            <strong>{formaterFCFA(valide)}</strong>
          </div>
          <div>
            <span>Attendu</span>
            <strong>{formaterFCFA(attendu)}</strong>
          </div>
        </div>
      </div>
      {progression !== null ? (
        <div
          className="dashboard-collection-progress"
          role="progressbar"
          aria-label="Progression du recouvrement mensuel"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progression}
          aria-valuetext={excedent > 0
            ? `${formaterFCFA(valide)} validés pour ${formaterFCFA(attendu)} attendus, montant supérieur à 100 %`
            : `${taux}% validés, ${formaterFCFA(valide)} sur ${formaterFCFA(attendu)}`}
        >
          <span style={{ width: `${progression}%` }} />
        </div>
      ) : null}
    </section>
  )
}

function ActionContextuelle({
  type,
  nbLogementsLibres,
  nbLocataires,
  montantRestant,
  logementSansAnnonce,
}: {
  type: 'enregistrer-paiement' | 'creer-bail' | 'preparer-annonce'
  nbLogementsLibres: number
  nbLocataires: number
  montantRestant: number
  logementSansAnnonce?: LogementDashboard
}) {
  const contenu = {
    'enregistrer-paiement': {
      titre: 'Suivre les loyers du mois',
      description: `${formaterFCFA(montantRestant)} de loyers attendus ne sont pas encore couverts par un versement validé.`,
      href: '/pro/paiements/nouveau',
      action: 'Enregistrer un paiement',
    },
    'creer-bail': {
      titre: 'Un logement et un locataire sont prêts',
      description: `${nbLogementsLibres} logement${nbLogementsLibres > 1 ? 's' : ''} libre${nbLogementsLibres > 1 ? 's' : ''} · ${nbLocataires} fiche${nbLocataires > 1 ? 's' : ''} locataire.`,
      href: '/pro/baux/nouveau',
      action: 'Créer un bail',
    },
    'preparer-annonce': {
      titre: 'Proposer un logement disponible',
      description: logementSansAnnonce
        ? `${logementSansAnnonce.type} · ${logementSansAnnonce.ville}`
        : 'Préparez une annonce depuis un logement libre.',
      href: logementSansAnnonce
        ? `/pro/annonces/nouvelle?logement=${encodeURIComponent(logementSansAnnonce.id)}`
        : '/pro/annonces',
      action: 'Préparer une annonce',
    },
  }[type]

  return (
    <section className="dashboard-next-action" aria-labelledby="dashboard-next-action-title">
      <div>
        <p className="dashboard-eyebrow">À faire maintenant</p>
        <h2 id="dashboard-next-action-title">{contenu.titre}</h2>
        <p>{contenu.description}</p>
      </div>
      <Link href={contenu.href} className="btn btn-primary" data-visite={type === 'enregistrer-paiement' ? 'bouton-paiement' : undefined}>
        {contenu.action} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  )
}

function EnteteDemarrage({
  titre,
  description,
  action,
  bienvenue,
}: {
  titre: string
  description: string
  action?: ReactNode
  bienvenue: boolean
}) {
  return (
    <header className="dashboard-welcome-copy">
      <div className="dashboard-welcome-heading">
        <div className="min-w-0">
          <h1 className="dashboard-welcome-title">{titre}</h1>
          <p className="dashboard-welcome-description">{description}</p>
        </div>
        {action ? <div className="dashboard-welcome-secondary">{action}</div> : null}
      </div>
      {bienvenue ? (
        <p className="dashboard-onboarding-confirmation" role="status">
          <Check size={16} strokeWidth={2.2} aria-hidden="true" />
          Votre espace Pro est prêt.
        </p>
      ) : null}
    </header>
  )
}

function LigneMiseEnRoute({
  numero,
  titre,
  description,
  terminee,
  action,
  href,
  principale = false,
  attente,
}: {
  numero: string
  titre: string
  description: string
  terminee: boolean
  action?: string
  href?: string
  principale?: boolean
  attente?: string
}) {
  return (
    <li className={`dashboard-setup-row${principale ? ' dashboard-setup-row-highlight' : ''}`}>
      <div className="dashboard-setup-row-main">
        <span
          className={`dashboard-setup-marker${terminee ? ' is-complete' : ''}`}
          aria-hidden="true"
        >
          {terminee ? <Check size={16} strokeWidth={2.3} aria-hidden="true" /> : numero}
        </span>
        <div className="dashboard-setup-copy">
          <div className="dashboard-setup-title-line">
            <h3>{titre}</h3>
            <span className={`dashboard-setup-status${terminee ? ' is-complete' : ''}`}>
              {terminee ? 'Enregistré' : 'À faire'}
            </span>
          </div>
          <p>{description}</p>
        </div>
        {href && action ? (
          <Link
            href={href}
            className={principale ? 'btn btn-primary dashboard-setup-primary' : 'dashboard-setup-action'}
          >
            {action}
            {!principale ? <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" /> : null}
          </Link>
        ) : (
          <span className="dashboard-setup-waiting">{attente ?? 'À votre rythme'}</span>
        )}
      </div>
    </li>
  )
}

function MiseEnRoute({
  nbLogements,
  nbLocataires,
  nbBaux,
  nbLogementsLibres,
}: {
  nbLogements: number
  nbLocataires: number
  nbBaux: number
  nbLogementsLibres: number
}) {
  const progression = compterEtapesConfigurees({ nbLogements, nbLocataires, nbBaux })
  const bailPossible = peutCreerBail({ nbLogementsLibres, nbLocataires })
  // Un locataire n'est pas un prérequis pour commercialiser un logement vacant.
  // Quand il n'existe pas encore de fiche locataire, l'alternative Find prend
  // le premier plan plutôt que de laisser croire qu'il faut en créer une.
  const actionPrincipale = determinerActionPrincipaleDemarrage({ nbLogements, nbLocataires })
  const etapePrincipale = actionPrincipale === 'logement' ? 1 : actionPrincipale === 'bail' ? 3 : 0

  return (
    <section className="dashboard-setup" aria-labelledby="mise-en-route">
      <header className="dashboard-setup-heading">
        <div>
          <h2 id="mise-en-route">Mise en route</h2>
          <p>Préparez votre espace en quelques étapes.</p>
        </div>
        <span className="dashboard-setup-progress" aria-label={`${progression} étapes sur 3 enregistrées`}>
          {progression} <span aria-hidden="true">/</span> 3 étapes
        </span>
      </header>

      <ol className="dashboard-setup-list">
        <LigneMiseEnRoute
          numero="01"
          titre="Ajouter un logement"
          description="Enregistrez votre premier bien immobilier."
          terminee={nbLogements > 0}
          href={nbLogements > 0 ? '/pro/logements' : '/pro/logements/nouveau'}
          action={nbLogements > 0 ? 'Voir les logements' : 'Ajouter le logement'}
          principale={etapePrincipale === 1}
        />
        <LigneMiseEnRoute
          numero="02"
          titre="Ajouter un locataire"
          description={
            nbLocataires > 0
              ? 'Votre fiche locataire est enregistrée.'
              : 'Si votre logement est déjà occupé, renseignez les informations de son locataire.'
          }
          terminee={nbLocataires > 0}
          href={nbLocataires > 0 ? '/pro/locataires' : '/pro/locataires/nouveau'}
          action={nbLocataires > 0 ? 'Voir les locataires' : 'Ajouter un locataire'}
        />
        <LigneMiseEnRoute
          numero="03"
          titre="Créer un bail"
          description={
            bailPossible
              ? 'Associez un logement libre et un locataire à un contrat de location.'
              : nbLocataires === 0
                ? 'Lorsque votre logement est occupé, ajoutez d’abord le locataire à rattacher.'
                : 'Un bail peut être créé lorsqu’un logement sans bail actif et un locataire sont prêts.'
          }
          terminee={nbBaux > 0}
          href={bailPossible ? '/pro/baux/nouveau' : undefined}
          action={bailPossible ? 'Créer un bail' : undefined}
          principale={etapePrincipale === 3 && bailPossible}
          attente={nbLocataires === 0 ? 'Après le locataire' : 'Aucun logement libre'}
        />
      </ol>
    </section>
  )
}

function ResumeLogements({ logements, total }: { logements: LogementDashboard[]; total: number }) {
  const visibles = logements.slice(0, 3)

  return (
    <aside className="dashboard-homes-summary" aria-label="Résumé des logements enregistrés">
      <div className="dashboard-homes-heading">
        <div>
          <p className="dashboard-homes-count">
            {total} logement{total === 1 ? '' : 's'} enregistré{total === 1 ? '' : 's'}
          </p>
          <p className="dashboard-homes-caption">Votre parc immobilier</p>
        </div>
        <House size={19} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <ul className="dashboard-homes-list">
        {visibles.map((logement) => {
          const annonce = annonceVivante(logement)
          const occupe = logementOccupe(logement)
          const etat = occupe
            ? 'Loué'
            : annonce
              ? annonce.statut === 'publiee'
                ? 'Annonce publiée'
                : annonce.statut === 'brouillon'
                  ? 'Brouillon'
                  : 'Annonce suspendue'
              : 'Disponible'

          return (
            <li key={logement.id} className="dashboard-home-row">
              <div className="min-w-0">
                <p className="dashboard-home-address">{logement.adresse}</p>
                <p className="dashboard-home-meta">{logement.type} · {logement.ville}</p>
              </div>
              <span className={`dashboard-home-status${occupe ? ' is-occupied' : ' is-available'}`}>
                {etat}
              </span>
            </li>
          )
        })}
      </ul>
      {total > visibles.length ? (
        <p className="dashboard-homes-more">+ {total - visibles.length} autre{total - visibles.length > 1 ? 's' : ''}</p>
      ) : null}
      <Link href="/pro/logements" className="dashboard-homes-link">
        Voir les logements <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </aside>
  )
}

function PisteFind({
  logements,
  sansLogement,
  prioritaire = false,
}: {
  logements: LogementDashboard[]
  sansLogement: boolean
  prioritaire?: boolean
}) {
  const logementLibre = logements.find((logement) => !logementOccupe(logement) && !annonceVivante(logement))
  const logementOccupeSansAnnonce = logements.find((logement) => logementOccupe(logement) && !annonceVivante(logement))
  const annoncesExistantes = logements.some((logement) => Boolean(annonceVivante(logement)))
  const logementCible = logementLibre ?? logementOccupeSansAnnonce

  const action = sansLogement
    ? null
    : logementCible
      ? {
          href: `/pro/annonces/nouvelle?logement=${encodeURIComponent(logementCible.id)}`,
          libelle: logementLibre ? 'Préparer une annonce' : 'Préparer un brouillon',
        }
      : annoncesExistantes
        ? { href: '/pro/annonces', libelle: 'Gérer mes annonces' }
        : null

  const description = sansLogement
    ? 'Ajoutez d’abord un logement : chaque annonce Sikaloc | Find est rattachée à un bien enregistré.'
    : logementLibre
      ? 'Proposez un logement disponible aux candidats. L’annonce commence en brouillon ; vous décidez ensuite de sa publication.'
      : logementOccupeSansAnnonce
        ? 'Vous pouvez préparer un brouillon pendant le bail ; sa publication attendra la fin du bail en cours.'
        : 'Consultez vos annonces et leur état de publication depuis votre espace de commercialisation.'

  return (
    <section className="dashboard-find-callout" aria-labelledby="find-callout-title">
      <div className="dashboard-find-copy">
        <h2 id="find-callout-title">Votre logement est disponible à la location ?</h2>
        <p>{description}</p>
      </div>
      {action ? (
        <Link
          href={action.href}
          className={`btn ${prioritaire ? 'btn-primary' : 'btn-secondary'} dashboard-find-action`}
        >
          {action.libelle} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  )
}

export default async function PageTableauDeBord({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>
}) {
  const [{ bienvenue }, [bailleur, supabase]] = await Promise.all([
    searchParams,
    Promise.all([bailleurOnboarde(), creerClientServeur()]),
  ])

  const [logementsReponse, locatairesReponse, bauxReponse, progressionReponse] = await Promise.all([
    supabase
      .from('logements')
      .select('id, adresse, type, ville, baux(id, statut), annonces(id, statut)', { count: 'exact' })
      .eq('bailleur_id', bailleur.id)
      .order('created_at', { ascending: false }),
    supabase.from('locataires').select('id', { count: 'exact', head: true }).eq('bailleur_id', bailleur.id),
    supabase.from('baux').select('id', { count: 'exact', head: true }).eq('bailleur_id', bailleur.id),
    supabase.from('v_progression_visite').select('*').eq('bailleur_id', bailleur.id).maybeSingle(),
  ])

  const logements = (logementsReponse.data ?? []) as unknown as LogementDashboard[]
  const nbLogements = logementsReponse.count ?? logements.length
  const nbLocataires = locatairesReponse.count ?? 0
  const nbBaux = bauxReponse.count ?? 0
  const etat = determinerEtatDashboardPro(nbLogements, nbBaux)
  const erreurEtat = logementsReponse.error || locatairesReponse.error || bauxReponse.error

  const parcoursVisite = progressionReponse.data
    ? avancement(progressionReponse.data, {
        tutoriel_vu_le: bailleur.tutoriel_vu_le,
        visite_quittee_le: bailleur.visite_quittee_le,
      })
    : null
  const visiteClose = parcoursVisite ? !ouvertureAutomatique(parcoursVisite) : false
  const actionVisite = visiteClose && !bienvenue
    ? <ReprendreVisite terminee={Boolean(bailleur.tutoriel_vu_le)} />
    : undefined

  if (erreurEtat) {
    return (
      <div className="dashboard-home">
        <EnTetePage titre="Tableau de bord" description="Votre activité locative en temps réel." />
        <Alerte ton="erreur">
          Les données de votre espace ne peuvent pas être chargées. Actualisez la page pour réessayer ; aucun état vide n’est affiché tant que la lecture n’a pas abouti.
        </Alerte>
      </div>
    )
  }

  if (etat !== 'operationnel') {
    const nbLogementsLibres = logements.filter((logement) => !logementOccupe(logement)).length
    const actionPrincipale = determinerActionPrincipaleDemarrage({ nbLogements, nbLocataires })
    const titre = etat === 'demarrage'
      ? 'Bienvenue dans votre espace Pro.'
      : 'Votre premier logement est enregistré.'
    const description = etat === 'demarrage'
      ? 'Organisez vos locations, en commençant par votre premier logement.'
      : 'Vous pouvez maintenant organiser sa location ou le proposer sur Find.'

    return (
      <div className="dashboard-home dashboard-first-run">
        <section className={`dashboard-welcome${etat === 'intermediaire' ? ' has-homes' : ''}`}>
          <EnteteDemarrage
            titre={titre}
            description={description}
            action={actionVisite}
            bienvenue={bienvenue === '1'}
          />
          {etat === 'intermediaire' ? <ResumeLogements logements={logements} total={nbLogements} /> : null}
        </section>

        <MiseEnRoute
          nbLogements={nbLogements}
          nbLocataires={nbLocataires}
          nbBaux={nbBaux}
          nbLogementsLibres={nbLogementsLibres}
        />

        <PisteFind
          logements={logements}
          sansLogement={etat === 'demarrage'}
          prioritaire={etat === 'intermediaire' && actionPrincipale === 'find'}
        />
      </div>
    )
  }

  const [metriquesReponse, impayesReponse, paiementsReponse, brouillonsReponse, echeancesReponse] = await Promise.all([
    supabase.from('v_metriques_dashboard').select('*').eq('bailleur_id', bailleur.id).maybeSingle(),
    supabase
      .from('v_impayes')
      .select('bail_id, periode_debut, montant_du, jours_de_retard, locataire_nom, logement_adresse', { count: 'exact' })
      .eq('bailleur_id', bailleur.id)
      .order('periode_debut', { ascending: true })
      .limit(4),
    supabase
      .from('paiements')
      .select('id, montant, date_paiement, periode_debut, statut, mode_paiement, bail:baux(locataire:locataires(nom)), quittance:quittances(id, type)')
      .eq('bailleur_id', bailleur.id)
      .eq('statut', 'Validé')
      .order('date_paiement', { ascending: false, nullsFirst: false })
      .order('periode_debut', { ascending: false })
      .limit(5),
    supabase
      .from('paiements')
      .select('id, montant, periode_debut, type_paiement, bail:baux(locataire:locataires(nom))', { count: 'exact' })
      .eq('bailleur_id', bailleur.id)
      .eq('statut', 'Brouillon')
      .order('created_at', { ascending: false })
      .limit(4),
    supabase
      .from('v_echeances')
      .select('bail_id, periode_debut, date_echeance, montant_du, locataire_nom, logement_adresse, etat')
      .eq('bailleur_id', bailleur.id)
      .eq('etat', 'À venir')
      .order('date_echeance', { ascending: true })
      .limit(3),
  ])

  const metriques = (metriquesReponse.data ?? null) as MetriquesDashboard | null
  const impayes = (impayesReponse.data ?? []) as ImpayeDashboard[]
  const paiements = (paiementsReponse.data ?? []) as unknown as PaiementDashboard[]
  const brouillons = (brouillonsReponse.data ?? []) as unknown as PaiementBrouillonDashboard[]
  const echeances = (echeancesReponse.data ?? []) as EcheanceDashboard[]
  const periodeCourante = periodeCouranteDashboard()
  const recouvrement = metriques
    ? presenterRecouvrementDashboard(metriques.loyers_attendus_mois, metriques.loyers_percus_mois)
    : null
  const nbBauxActifs = logements.reduce(
    (total, logement) => total + (logement.baux?.filter((bail) => bail.statut === 'Actif').length ?? 0),
    0,
  )
  const nbLogementsLibres = logements.filter((logement) => !logementOccupe(logement)).length

  const logementLibreSansAnnonce = logements.find(
    (logement) => !logementOccupe(logement) && !annonceVivante(logement),
  )
  const suiviUrgentConnu = !impayesReponse.error && !brouillonsReponse.error
  const actionContextuelle = metriques && recouvrement
    ? determinerActionContextuelleDashboard({
        nbBauxActifs,
        nbLogementsLibres,
        nbLocataires,
        loyerAttendu: recouvrement.attendu,
        loyerPercu: recouvrement.valide,
        logementLibreSansAnnonce: Boolean(logementLibreSansAnnonce),
        suiviUrgentConnu,
        nbImpayes: Number(impayesReponse.count ?? impayes.length),
        nbBrouillons: Number(brouillonsReponse.count ?? brouillons.length),
      })
    : 'aucune'

  return (
    <div className="dashboard-home dashboard-operational">
      <EnTetePage
        titre="Tableau de bord"
        description="Vos loyers, vos paiements et les actions à suivre."
        action={actionVisite}
      />

      {metriquesReponse.error ? (
        <Alerte ton="erreur">Les indicateurs ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
      ) : !metriques || !recouvrement ? (
        <Alerte ton="attention">Les indicateurs ne sont pas disponibles pour le moment.</Alerte>
      ) : (
        <>
          <SyntheseRecouvrement recouvrement={recouvrement} periode={periodeCourante} />
          <section data-visite="metriques" className="dashboard-supporting-metrics" aria-label="Indicateurs locatifs complémentaires">
            <CarteMetrique
              label="Occupation"
              valeur={`${Number(metriques.taux_occupation).toLocaleString('fr-FR')} %`}
              detail={`${Number(metriques.nb_baux_actifs)} bail${Number(metriques.nb_baux_actifs) === 1 ? '' : 's'} actif${Number(metriques.nb_baux_actifs) === 1 ? '' : 's'} sur ${Number(metriques.nb_logements)} logement${Number(metriques.nb_logements) === 1 ? '' : 's'}`}
              icone={<House size={19} strokeWidth={1.8} />}
            />
            <CarteMetrique
              label="Impayés"
              valeur={String(Number(metriques.nb_impayes))}
              ton={Number(metriques.nb_impayes) > 0 ? 'alerte' : 'neutre'}
              detail={Number(metriques.nb_impayes) > 0
                ? `${formaterFCFA(metriques.montant_impaye_total)} à recouvrer`
                : 'Aucun loyer en retard'}
              icone={<TriangleAlert size={19} strokeWidth={1.8} />}
            />
            <CarteMetrique
              label="Versements validés"
              valeur={formaterFCFA(metriques.ca_du_mois)}
              detail={`Paiements validés en ${formaterPeriode(periodeCourante)}`}
              icone={<Banknote size={19} strokeWidth={1.8} />}
            />
          </section>
        </>
      )}

      {actionContextuelle !== 'aucune' ? (
        <ActionContextuelle
          type={actionContextuelle}
          nbLogementsLibres={nbLogementsLibres}
          nbLocataires={nbLocataires}
          montantRestant={recouvrement?.reste ?? 0}
          logementSansAnnonce={logementLibreSansAnnonce}
        />
      ) : null}

      {impayesReponse.error || brouillonsReponse.error || impayes.length > 0 || brouillons.length > 0 ? (
        <section className="dashboard-content-section dashboard-watch-section" aria-labelledby="surveiller-title">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="surveiller-title" className="section-title">À surveiller</h2>
              <p className="text-body-sm text-mute">Les opérations qui demandent une vérification.</p>
            </div>
          </div>
          {brouillonsReponse.error ? <Alerte ton="erreur">Les paiements à confirmer ne peuvent pas être chargés.</Alerte> : null}
          {impayesReponse.error ? <Alerte ton="erreur">Les loyers en retard ne peuvent pas être chargés.</Alerte> : null}
          <ul className="dashboard-watch-list">
            {!brouillonsReponse.error ? brouillons.map((brouillon) => (
              <li key={brouillon.id}>
                <Link href={`/pro/paiements/${encodeURIComponent(brouillon.id)}/confirmer`} className="dashboard-watch-row">
                  <span className="dashboard-watch-icon is-pending"><ReceiptText size={17} aria-hidden="true" /></span>
                  <span className="dashboard-watch-copy">
                    <strong>Paiement à confirmer · {nomLocataire(brouillon.bail)}</strong>
                    <span>{formaterPeriode(brouillon.periode_debut)} · {brouillon.type_paiement}</span>
                  </span>
                  <span className="dashboard-watch-amount">{formaterFCFA(brouillon.montant)}</span>
                  <span className="dashboard-watch-link">Confirmer <ArrowRight size={15} aria-hidden="true" /></span>
                </Link>
              </li>
            )) : null}
            {!impayesReponse.error ? impayes.map((impaye) => (
              <li key={`${impaye.bail_id}-${impaye.periode_debut}`}>
                <Link href="/pro/impayes" className="dashboard-watch-row">
                  <span className="dashboard-watch-icon is-alert"><TriangleAlert size={17} aria-hidden="true" /></span>
                  <span className="dashboard-watch-copy">
                    <strong>{impaye.locataire_nom}</strong>
                    <span>{formaterPeriode(impaye.periode_debut)} · {impaye.jours_de_retard} jour{impaye.jours_de_retard > 1 ? 's' : ''} de retard · {impaye.logement_adresse}</span>
                  </span>
                  <span className="dashboard-watch-amount">{formaterFCFA(impaye.montant_du)}</span>
                  <span className="dashboard-watch-link">Voir <ArrowRight size={15} aria-hidden="true" /></span>
                </Link>
              </li>
            )) : null}
          </ul>
          {(Number(impayesReponse.count ?? 0) > impayes.length || Number(brouillonsReponse.count ?? 0) > brouillons.length) ? (
            <Link href={impayes.length < Number(impayesReponse.count ?? 0) ? '/pro/impayes' : '/pro/paiements'} className="dashboard-section-more">
              Voir tout le suivi <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : null}
        </section>
      ) : null}

      {echeancesReponse.error ? (
        <section className="dashboard-content-section" aria-labelledby="echeances-title">
          <h2 id="echeances-title" className="section-title">Échéances de loyer</h2>
          <Alerte ton="erreur">Les échéances ne peuvent pas être chargées. Actualisez la page pour réessayer.</Alerte>
        </section>
      ) : echeances.length > 0 ? (
        <section className="dashboard-content-section" aria-labelledby="echeances-title">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="echeances-title" className="section-title">Échéances à suivre</h2>
              <p className="text-body-sm text-mute">État calculé selon le bail et les versements validés.</p>
            </div>
            <Link href="/pro/paiements" className="dashboard-section-more">Paiements <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <ul className="dashboard-watch-list dashboard-due-list">
            {echeances.map((echeance) => (
              <li key={`${echeance.bail_id}-${echeance.periode_debut}`}>
                <Link href={`/pro/baux/${encodeURIComponent(echeance.bail_id)}`} className="dashboard-watch-row">
                  <span className="dashboard-watch-icon"><ArrowDownRight size={17} aria-hidden="true" /></span>
                  <span className="dashboard-watch-copy">
                    <strong>{echeance.locataire_nom} · {formaterPeriode(echeance.periode_debut)}</strong>
                    <span>Échéance {formaterDateCourte(echeance.date_echeance)} · {echeance.logement_adresse}</span>
                  </span>
                  <span className="dashboard-watch-amount">{formaterFCFA(echeance.montant_du)}</span>
                  <span className="dashboard-watch-link">Voir le bail <ArrowRight size={15} aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="dashboard-content-section" aria-labelledby="paiements-recents">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="paiements-recents" className="section-title">Derniers paiements</h2>
            <p className="text-body-sm text-mute">Versements validés récemment dans votre espace.</p>
          </div>
          {paiements.length > 0 ? (
            <Link href="/pro/paiements" className="dashboard-section-more">
              Historique complet
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {paiementsReponse.error ? (
          <Alerte ton="erreur">Les paiements ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
        ) : paiements.length === 0 ? (
          <div className="dashboard-payments-empty">
            <ReceiptText size={24} strokeWidth={1.7} aria-hidden="true" className="dashboard-payments-empty-icon" />
            <div>
              <h3>Aucun paiement validé pour le moment</h3>
              <p>Les versements validés apparaîtront ici avec leur période et leur montant.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden sm:block">
              <TableauListe id="derniers-paiements" libelle="Derniers paiements">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Locataire</th>
                      <th scope="col">Période</th>
                      <th scope="col" className="hidden sm:table-cell">Date</th>
                      <th scope="col" className="hidden md:table-cell">Mode</th>
                      <th scope="col" className="text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paiements.map((paiement) => (
                      <tr key={paiement.id}>
                        <td className="font-semibold">{nomLocataire(paiement.bail)}</td>
                        <td>{formaterPeriode(paiement.periode_debut)}</td>
                        <td className="hidden sm:table-cell">{formaterDateCourte(paiement.date_paiement)}</td>
                        <td className="hidden md:table-cell">{paiement.mode_paiement}</td>
                        <td className="text-right font-semibold tabular">
                          <span className="dashboard-payment-amount">{formaterFCFA(paiement.montant)}</span>
                          <LienJustificatifPaiement paiement={paiement} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableauListe>
            </div>
            <ul className="dashboard-payments-mobile-list sm:hidden" aria-label="Derniers paiements validés">
              {paiements.map((paiement) => (
                <li key={paiement.id}>
                  <div>
                    <strong>{nomLocataire(paiement.bail)}</strong>
                    <span>{formaterPeriode(paiement.periode_debut)} · {formaterDateCourte(paiement.date_paiement)}</span>
                    <LienJustificatifPaiement paiement={paiement} />
                  </div>
                  <strong className="dashboard-watch-amount">{formaterFCFA(paiement.montant)}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
