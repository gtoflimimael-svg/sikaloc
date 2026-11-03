import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Receipt } from 'lucide-react'

import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Alerte, Badge, EtatVide } from '@/components/ui/retours'
import { TableauListe } from '@/components/ui/listes'
import { reactiverBail, resilierBail, supprimerBail } from '@/lib/actions/baux'
import { peutSupprimerBail } from '@/lib/baux-presentation'
import {
  formaterDate,
  formaterDateCourte,
  formaterFCFA,
  formaterPeriode,
} from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Impaye } from '@/lib/types/database'
import { formaterTelephone } from '@/lib/telephone'
import { etatPaiementFinance } from '@/lib/documents-paiement'

export const metadata: Metadata = { title: 'Détail du bail' }

export default async function PageDetailBail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await creerClientServeur()

  // `bailleurOnboarde()` ne conditionne pas la requête suivante — `id` vient
  // des params, et les RLS scopent la ligne de toute façon. Les deux partent
  // donc en parallèle ; seul le `notFound()` qui suit reste séquentiel, car
  // lui dépend réellement du résultat.
  const [, { data: bail, error: erreurBail }] = await Promise.all([
    bailleurOnboarde(),
    supabase
      .from('baux')
      .select(
        '*, logement:logements(id, adresse, ville, pays, type), locataire:locataires(id, nom, telephone, email)',
      )
      .eq('id', id)
      .maybeSingle(),
  ])

  if (erreurBail) {
    return (
      <Alerte ton="erreur">
        Les informations du bail ne peuvent pas être chargées. Actualisez la page pour réessayer.
      </Alerte>
    )
  }
  if (!bail) notFound()

  const [
    { data: paiements, error: erreurPaiements },
    { data: impayes, error: erreurImpayes },
    { count: aDeterminer, error: erreurEcheances },
    { data: excedents, error: erreurExcedents },
  ] = await Promise.all([
      supabase
        .from('paiements')
        .select('*, quittance:quittances(id, numero_document, type, donnees_financieres)')
        .eq('bail_id', id)
        .order('periode_debut', { ascending: false })
        .limit(24),
      supabase
        .from('v_impayes')
        .select('*')
        .eq('bail_id', id)
        .order('periode_debut', { ascending: true }),
      // Les échéances antérieures à l'enregistrement sur lesquelles personne ne
      // s'est prononcé. Elles ne sont réclamées à personne — mais le bailleur
      // doit savoir qu'on l'attend, sinon elles resteraient en suspens.
      supabase
        .from('v_echeances')
        .select('periode_debut', { count: 'exact', head: true })
        .eq('bail_id', id)
        .eq('etat', 'À déterminer'),
      supabase
        .from('v_echeances')
        .select('periode_debut, montant_excedentaire')
        .eq('bail_id', id)
        .gt('montant_excedentaire', 0)
        .order('periode_debut', { ascending: false })
        .limit(12),
  ])

  const logement = Array.isArray(bail.logement) ? bail.logement[0] : bail.logement
  const locataire = Array.isArray(bail.locataire) ? bail.locataire[0] : bail.locataire
  const listePaiements = paiements ?? []
  const listeImpayes = (impayes ?? []) as Impaye[]
  const listeExcedents = excedents ?? []
  const suppressionBailPossible = peutSupprimerBail(listePaiements.length, !erreurPaiements)
  const paiementsAffiches = listePaiements.map((paiement) => ({
    paiement,
    quittance: Array.isArray(paiement.quittance) ? paiement.quittance[0] : paiement.quittance,
  })).map(({ paiement, quittance }) => ({
    paiement,
    quittance,
    etatFinancier: etatPaiementFinance({
      statut: paiement.statut,
      typePaiement: paiement.type_paiement,
      estPartiel: paiement.est_partiel,
      finances: quittance?.donnees_financieres,
    }),
  }))

  return (
    <div className="lease-detail-page space-y-2xl">
      {erreurEcheances ? (
        <Alerte ton="erreur">
          Le suivi des échéances n’a pas pu être vérifié. Actualisez la page avant d’utiliser ces informations.
        </Alerte>
      ) : null}
      {/*
        Le bail a commencé avant son enregistrement, et personne ne s'est encore
        prononcé sur les mois d'avant. Ils ne figurent nulle part dans les
        impayés — c'est voulu — mais ils ne doivent pas rester invisibles pour
        autant : sans cette invite, le bailleur ne saurait jamais qu'il reste
        quelque chose à dire.
      */}
      {(aDeterminer ?? 0) > 0 ? (
        <Alerte ton="info">
          Ce bail a commencé avant son enregistrement dans Sikaloc.{' '}
          <strong>
            {aDeterminer} mois {(aDeterminer ?? 0) > 1 ? 'restent' : 'reste'} à
            renseigner
          </strong>{' '}
          : tant que ce n&apos;est pas fait, ils ne sont comptés ni comme réglés,
          ni comme en retard.{' '}
          <Link href={`/pro/baux/${id}/historique`} className="font-semibold underline">
            Renseigner l&apos;historique
          </Link>
        </Alerte>
      ) : null}

      <div>
        <Link href="/pro/baux" className="text-body-sm text-mute hover:text-ink">
          ← Tous les baux
        </Link>

        <div className="lease-detail-heading mt-lg flex flex-wrap items-start justify-between gap-lg">
          <div className="flex min-w-0 items-center gap-lg">
            <div>
              <h1 className="page-title">
                {locataire?.nom ?? 'Locataire'}
              </h1>
              <p className="mt-xxs text-body-md text-mute">
                {logement?.adresse}
                {logement?.ville ? `, ${logement.ville}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            <Badge ton={bail.statut === 'Actif' ? 'positive' : 'neutral'}>{bail.statut}</Badge>
            <Link href={`/pro/baux/${id}/modifier`} className="btn btn-tertiary btn-sm">
              Modifier
            </Link>
            {bail.statut === 'Actif' ? (
              <Link
                href={`/pro/paiements/nouveau?bail=${id}`}
                className="btn btn-primary btn-sm"
              >
                Enregistrer un paiement
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Caractéristiques ───────────────────────────────────────────── */}
      <section aria-labelledby="conditions-bail">
        <h2 id="conditions-bail" className="section-title">Conditions du bail</h2>
        <dl className="lease-detail-facts">
        <Fiche libelle="Loyer mensuel" valeur={formaterFCFA(bail.loyer_mensuel)} />
        <Fiche libelle="Jour d'échéance" valeur={`Le ${bail.jour_echeance} du mois`} />
        <Fiche libelle="Tolérance" valeur={`${bail.tolerance_jours} jours`} />
        <Fiche
          libelle="Dépôt de garantie"
          valeur={bail.depot_garantie ? formaterFCFA(bail.depot_garantie) : '—'}
        />
        <Fiche libelle="Début du bail" valeur={formaterDate(bail.date_debut)} />
        <Fiche
          libelle="Fin du bail"
          valeur={bail.date_fin ? formaterDate(bail.date_fin) : 'Durée indéterminée'}
        />
        <Fiche libelle="Type de bien" valeur={logement?.type ?? '—'} />
        <Fiche
          libelle="Téléphone locataire"
          valeur={locataire ? formaterTelephone(locataire.telephone) : '—'}
        />
        </dl>
      </section>

      {/* ── Impayés du bail ────────────────────────────────────────────── */}
      {erreurImpayes || listeImpayes.length > 0 ? (
        <section>
          <h2 className="mb-lg section-title">
            Loyers en retard sur ce bail
          </h2>
          {erreurImpayes ? (
            <Alerte ton="erreur">Les loyers en retard n’ont pas pu être vérifiés.</Alerte>
          ) : <div className="lease-arrears-list">
            {listeImpayes.map((impaye) => (
              <div
                key={impaye.periode_debut}
                className="lease-arrears-row"
              >
                <div>
                  <p className="text-body-md font-semibold text-ink">
                    {formaterPeriode(impaye.periode_debut)}
                  </p>
                  <p className="text-body-sm text-mute">
                    Échéance du {formaterDate(impaye.date_echeance)} ·{' '}
                    {impaye.jours_de_retard} jour{impaye.jours_de_retard > 1 ? 's' : ''} de
                    retard
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <span className="text-body-md font-semibold tabular text-ink">
                    {formaterFCFA(impaye.montant_du)}
                  </span>
                  <Link href="/pro/impayes" className="btn btn-primary btn-sm">
                    Relancer
                  </Link>
                </div>
              </div>
            ))}
          </div>}
        </section>
      ) : null}

      {erreurExcedents ? (
        <Alerte ton="erreur">Les éventuels excédents n’ont pas pu être vérifiés.</Alerte>
      ) : listeExcedents.length > 0 ? (
        <section className="lease-excess-note">
          <h2 className="text-body-md font-semibold text-ink">Excédents non reportés</h2>
          <p className="mt-xs text-body-sm text-mute">
            Ces versements dépassent le loyer de leur période. Ils ne réduisent pas automatiquement le mois suivant.
          </p>
          <ul className="mt-md space-y-xs">
            {listeExcedents.map((ligne) => (
              <li key={ligne.periode_debut} className="flex justify-between gap-md text-body-sm">
                <span>{formaterPeriode(ligne.periode_debut)}</span>
                <strong className="tabular">{formaterFCFA(ligne.montant_excedentaire)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Historique ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-lg section-title">
          Historique des paiements
        </h2>

        {erreurPaiements ? (
          <Alerte ton="erreur">L’historique des paiements n’a pas pu être chargé.</Alerte>
        ) : listePaiements.length === 0 ? (
          <EtatVide
            icone={<Receipt size={24} strokeWidth={1.8} aria-hidden="true" />}
            titre="Aucun paiement sur ce bail"
            description="Après validation, chaque paiement reçoit le document correspondant à sa nature et au solde de la période."
            action={
              <Link href={`/pro/paiements/nouveau?bail=${id}`} className="btn btn-primary">
                Enregistrer un paiement
              </Link>
            }
          />
        ) : (
          <>
          <ul className="payment-mobile-list sm:hidden" aria-label="Historique des paiements du bail">
            {paiementsAffiches.map(({ paiement, quittance, etatFinancier }) => (
              <li key={paiement.id}>
                <div className="payment-mobile-heading">
                  <h3>{formaterPeriode(paiement.periode_debut)}</h3>
                  <strong className="tabular">{formaterFCFA(paiement.montant)}</strong>
                </div>
                <p className="mt-xs text-body-sm text-mute">
                  {paiement.historique ? 'Avant Sikaloc' : formaterDateCourte(paiement.date_paiement)}
                  {paiement.mode_paiement ? ` · ${paiement.mode_paiement}` : ''}
                </p>
                <div className="mt-md flex flex-wrap items-center justify-between gap-sm">
                  <Badge ton={etatFinancier === 'Payé' ? 'positive' : 'warning'}>
                    {etatFinancier}
                  </Badge>
                  <Link href={quittance ? `/pro/quittances/${quittance.id}` : `/pro/paiements/${paiement.id}/confirmer`} className="text-body-sm font-semibold text-ink underline underline-offset-4">
                    {quittance ? `Voir ${quittance.type === 'Quittance' ? 'la quittance' : 'le reçu'}` : 'À valider'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
          <TableauListe id="paiements-bail" libelle="Historique des paiements du bail">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Période</th>
                  <th scope="col">Date</th>
                  <th scope="col" className="hidden sm:table-cell">
                    Mode
                  </th>
                  <th scope="col">Statut</th>
                  <th scope="col" className="text-right">
                    Montant
                  </th>
                  <th scope="col" className="text-right">
                    Document
                  </th>
                </tr>
              </thead>
              <tbody>
                {paiementsAffiches.map(({ paiement, quittance, etatFinancier }) => {
                  return (
                    <tr key={paiement.id}>
                      <td className="font-semibold">
                        {formaterPeriode(paiement.periode_debut)}
                      </td>
                      <td>
                        {paiement.historique ? (
                          // Pas de date : c'est la vérité, elle n'est pas connue.
                          // Le dire vaut mieux que d'afficher une date inventée.
                          <span className="text-mute">Avant Sikaloc</span>
                        ) : (
                          formaterDateCourte(paiement.date_paiement)
                        )}
                      </td>
                      <td className="hidden sm:table-cell">{paiement.mode_paiement}</td>
                      <td>
                        <Badge ton={etatFinancier === 'Payé' ? 'positive' : 'warning'}>
                          {etatFinancier}
                        </Badge>
                      </td>
                      <td className="text-right font-semibold tabular">
                        {formaterFCFA(paiement.montant)}
                      </td>
                      <td className="text-right">
                        {quittance ? (
                          <Link
                            href={`/pro/quittances/${quittance.id}`}
                            className="font-semibold text-ink underline"
                          >
                            {quittance.type}
                          </Link>
                        ) : (
                          <Link
                            href={`/pro/paiements/${paiement.id}/confirmer`}
                            className="text-mute underline"
                          >
                            À valider
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableauListe>
          </div>
          </>
        )}
      </section>

      {/* ── Zone sensible ──────────────────────────────────────────────── */}
      <section className="lease-lifecycle">
        <h2 className="section-title">Cycle de vie du bail</h2>
        <p className="mt-xs text-body-sm text-mute">
          La résiliation libère le logement : vous pourrez y créer un nouveau bail.
          L&apos;historique des paiements est conservé.
        </p>

        <div className="mt-lg flex flex-wrap items-start gap-md">
          {bail.statut === 'Actif' ? (
            <ActionConfirmee
              action={resilierBail.bind(null, id)}
              libelle="Résilier le bail"
              variante="tertiary"
              titreConfirmation="Résilier ce bail ?"
              messageConfirmation="Le logement redeviendra disponible et la détection des impayés s’arrêtera à la date de fin. L’historique reste consultable."
              libelleConfirmation="Résilier"
            />
          ) : (
            <ActionConfirmee
              action={reactiverBail.bind(null, id)}
              libelle="Réactiver le bail"
              variante="tertiary"
              titreConfirmation="Réactiver ce bail ?"
              messageConfirmation="Le bail redeviendra actif et sa date de fin sera effacée. L’opération échouera si le logement porte déjà un autre bail actif."
              libelleConfirmation="Réactiver"
            />
          )}

          {suppressionBailPossible ? (
            <ActionConfirmee
              action={supprimerBail.bind(null, id)}
              libelle="Supprimer le bail"
              titreConfirmation="Supprimer ce bail définitivement ?"
              messageConfirmation="Action irréversible. Les baux associés à des paiements ne peuvent pas être supprimés."
              libelleConfirmation="Supprimer définitivement"
            />
          ) : (
            <p className="text-body-sm text-mute" role="note">
              {erreurPaiements
                ? 'Suppression indisponible : l’historique des paiements n’a pas pu être vérifié.'
                : 'Ce bail conserve des paiements et ne peut pas être supprimé. Résiliez-le pour préserver son historique.'}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function Fiche({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div>
      <dt>{libelle}</dt>
      <dd className="tabular">{valeur}</dd>
    </div>
  )
}
