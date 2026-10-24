import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Banknote, Check, CircleDollarSign, House, TriangleAlert } from 'lucide-react'

import { ReprendreVisite } from '@/components/app/reprendre-visite'
import { CarteMetrique } from '@/components/app/carte-metrique'
import { Alerte, Badge, EnTetePage } from '@/components/ui/retours'
import { TableauListe } from '@/components/ui/listes'
import { ESPACE_PRO } from '@/lib/roles'
import { bailleurOnboarde } from '@/lib/session'
import { avancement, ouvertureAutomatique } from '@/lib/visite/etapes'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Impaye, MetriquesDashboard, StatutAnnonce } from '@/lib/types/database'
import { compterEtapesConfigurees, determinerActionPrincipaleDemarrage, determinerEtatDashboardPro, peutCreerBail } from '@/lib/dashboard/etat'
import { formaterDateCourte, formaterFCFA, formaterPeriode } from '@/lib/format'

export const metadata: Metadata = { title: { absolute: `Tableau de bord · ${ESPACE_PRO.nom}` } }

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
  date_paiement: string
  periode_debut: string
  statut: string
  mode_paiement: string
  bail: { locataire?: { nom?: string } | { nom?: string }[] } | null
}

function logementOccupe(logement: LogementDashboard) {
  return logement.baux?.some((bail) => bail.statut === 'Actif') ?? false
}

function annonceVivante(logement: LogementDashboard) {
  return logement.annonces?.find((annonce) => annonce.statut !== 'cloturee')
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

  const [metriquesReponse, impayesReponse, paiementsReponse] = await Promise.all([
    supabase.from('v_metriques_dashboard').select('*').eq('bailleur_id', bailleur.id).maybeSingle(),
    supabase
      .from('v_impayes')
      .select('*')
      .eq('bailleur_id', bailleur.id)
      .order('periode_debut', { ascending: true })
      .limit(4),
    supabase
      .from('paiements')
      .select('id, montant, date_paiement, periode_debut, statut, mode_paiement, bail:baux(locataire:locataires(nom))')
      .eq('bailleur_id', bailleur.id)
      .eq('statut', 'Validé')
      .order('date_paiement', { ascending: false, nullsFirst: false })
      .order('periode_debut', { ascending: false })
      .limit(5),
  ])

  const metriques = (metriquesReponse.data ?? null) as MetriquesDashboard | null
  const impayes = (impayesReponse.data ?? []) as Impaye[]
  const paiements = (paiementsReponse.data ?? []) as unknown as PaiementDashboard[]
  const nbBauxActifs = logements.reduce(
    (total, logement) => total + (logement.baux?.filter((bail) => bail.statut === 'Actif').length ?? 0),
    0,
  )
  const nbLogementsLibres = logements.filter((logement) => !logementOccupe(logement)).length

  const tauxRecouvrement =
    metriques && Number(metriques.loyers_attendus_mois) > 0
      ? Math.round((Number(metriques.loyers_percus_mois) / Number(metriques.loyers_attendus_mois)) * 100)
      : null

  const actionSecondaire = nbLogementsLibres > 0 && nbLocataires > 0
    ? { href: '/pro/baux/nouveau', libelle: 'Créer un bail' }
    : { href: '/pro/logements', libelle: 'Gérer les logements' }

  return (
    <div className="dashboard-home dashboard-operational">
      <EnTetePage
        titre="Tableau de bord"
        description="Votre activité locative en temps réel."
        action={actionVisite}
      />

      {metriquesReponse.error ? (
        <Alerte ton="erreur">Les indicateurs ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
      ) : !metriques ? (
        <Alerte ton="attention">Les indicateurs ne sont pas disponibles pour le moment.</Alerte>
      ) : (
        <section data-visite="metriques" className="grid gap-md sm:grid-cols-2" aria-label="Indicateurs locatifs">
          <CarteMetrique
            label="Taux d’occupation"
            valeur={`${Number(metriques.taux_occupation).toLocaleString('fr-FR')} %`}
            detail={`${Number(metriques.nb_baux_actifs)} bail${Number(metriques.nb_baux_actifs) === 1 ? '' : 's'} actif${Number(metriques.nb_baux_actifs) === 1 ? '' : 's'} · ${Number(metriques.nb_logements)} logement${Number(metriques.nb_logements) === 1 ? '' : 's'}`}
            icone={<House size={19} strokeWidth={1.8} />}
          />
          <CarteMetrique
            label="Taux de recouvrement"
            valeur={tauxRecouvrement === null ? '—' : `${tauxRecouvrement} %`}
            detail={
              Number(metriques.loyers_attendus_mois) > 0
                ? `${formaterFCFA(metriques.loyers_percus_mois)} sur ${formaterFCFA(metriques.loyers_attendus_mois)} attendus`
                : 'Aucun loyer exigible ce mois-ci'
            }
            icone={<CircleDollarSign size={19} strokeWidth={1.8} />}
          />
          <CarteMetrique
            label="Impayés"
            valeur={String(Number(metriques.nb_impayes))}
            ton={Number(metriques.nb_impayes) > 0 ? 'alerte' : 'neutre'}
            detail={
              Number(metriques.nb_impayes) > 0
                ? `${formaterFCFA(metriques.montant_impaye_total)} à recouvrer`
                : 'Aucun loyer en retard'
            }
            icone={<TriangleAlert size={19} strokeWidth={1.8} />}
          />
          <CarteMetrique
            label="CA du mois"
            valeur={formaterFCFA(metriques.ca_du_mois)}
            ton="primary"
            detail="Paiements validés ce mois-ci"
            icone={<Banknote size={19} strokeWidth={1.8} />}
          />
        </section>
      )}

      {impayesReponse.error ? (
        <section className="dashboard-content-section" aria-labelledby="impayes-title">
          <h2 id="impayes-title" className="section-title">Loyers en retard</h2>
          <Alerte ton="erreur">Les loyers en retard ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
        </section>
      ) : impayes.length > 0 ? (
        <section className="dashboard-content-section dashboard-overdue-section" aria-labelledby="impayes-title">
          <div className="dashboard-section-heading">
            <div>
              <h2 id="impayes-title" className="section-title">Loyers en retard</h2>
              <p className="text-body-sm text-mute">Les périodes qui demandent votre attention.</p>
            </div>
          </div>
          <div className="dashboard-arrears-list">
            {impayes.map((impaye) => (
              <div key={`${impaye.bail_id}-${impaye.periode_debut}`} className="dashboard-arrears-item">
                <div className="min-w-0">
                  <p className="truncate text-body-md font-semibold text-ink">{impaye.locataire_nom}</p>
                  <p className="truncate text-body-sm text-mute">
                    {formaterPeriode(impaye.periode_debut)} · {impaye.jours_de_retard} jour{impaye.jours_de_retard > 1 ? 's' : ''} de retard · {impaye.logement_adresse}
                  </p>
                </div>
                <div className="dashboard-arrears-aside">
                  <span className="text-body-md font-semibold tabular text-ink">{formaterFCFA(impaye.montant_du)}</span>
                  <Badge ton="negative">Impayé</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="dashboard-quick-actions" aria-labelledby="actions-rapides">
        <div className="dashboard-quick-actions-copy">
          <h2 id="actions-rapides">Actions rapides</h2>
          <p>Les opérations utiles à votre activité.</p>
        </div>
        <div className="dashboard-quick-actions-links">
          {nbBauxActifs > 0 && (paiements.length > 0 || Boolean(paiementsReponse.error)) ? (
            <Link href="/pro/paiements/nouveau" data-visite="bouton-paiement" className="btn btn-primary">
              Enregistrer un paiement <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : null}
          <Link href={actionSecondaire.href} className="btn btn-secondary">{actionSecondaire.libelle}</Link>
          {impayes.length > 0 ? (
            <Link href="/pro/impayes" className="dashboard-overdue-link">Suivre les retards</Link>
          ) : null}
        </div>
      </section>

      <section className="dashboard-content-section" aria-labelledby="paiements-recents">
        <div className="dashboard-section-heading">
          <div>
            <h2 id="paiements-recents" className="section-title">Derniers paiements</h2>
            <p className="text-body-sm text-mute">Les derniers versements validés dans votre espace.</p>
          </div>
          {paiements.length > 0 ? (
            <Link href="/pro/paiements" className="text-body-sm font-semibold text-ink underline">
              Historique complet
            </Link>
          ) : null}
        </div>

        {paiementsReponse.error ? (
          <Alerte ton="erreur">Les paiements ne peuvent pas être chargés. Actualisez la page pour réessayer.</Alerte>
        ) : paiements.length === 0 ? (
          <div className="dashboard-payments-empty">
            <Image
              src="/images/illustrations/paiement-justificatif.svg"
              alt="Un reçu de paiement stylisé avec un versement et une validation."
              width={132}
              height={102}
            />
            <div>
              <h3>Aucun paiement enregistré</h3>
              <p>Les versements validés apparaîtront ici avec leur période et leur montant.</p>
            </div>
            {nbBauxActifs > 0 ? (
              <Link href="/pro/paiements/nouveau" data-visite="bouton-paiement" className="btn btn-primary">
                Enregistrer un paiement
              </Link>
            ) : null}
          </div>
        ) : (
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
                {paiements.map((paiement) => {
                  const locataire = Array.isArray(paiement.bail?.locataire)
                    ? paiement.bail?.locataire[0]
                    : paiement.bail?.locataire

                  return (
                    <tr key={paiement.id}>
                      <td className="font-semibold">{locataire?.nom ?? '—'}</td>
                      <td>{formaterPeriode(paiement.periode_debut)}</td>
                      <td className="hidden sm:table-cell">{formaterDateCourte(paiement.date_paiement)}</td>
                      <td className="hidden md:table-cell">{paiement.mode_paiement}</td>
                      <td className="text-right font-semibold tabular">{formaterFCFA(paiement.montant)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableauListe>
        )}
      </section>
    </div>
  )
}
