import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Illustration } from '@/components/ui/illustration'
import { AvatarPeep } from '@/components/ui/avatar-peep'
import { ActionConfirmee } from '@/components/ui/action-confirmee'
import { Badge, EtatVide } from '@/components/ui/retours'
import { reactiverBail, resilierBail, supprimerBail } from '@/lib/actions/baux'
import {
  formaterDate,
  formaterDateCourte,
  formaterFCFA,
  formaterPeriode,
} from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'
import type { Impaye } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Détail du bail' }

export default async function PageDetailBail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await bailleurOnboarde()
  const { id } = await params
  const supabase = await creerClientServeur()

  const { data: bail } = await supabase
    .from('baux')
    .select(
      '*, logement:logements(id, adresse, ville, pays, type), locataire:locataires(id, nom, telephone, email)',
    )
    .eq('id', id)
    .maybeSingle()

  if (!bail) notFound()

  const [{ data: paiements }, { data: impayes }] = await Promise.all([
    supabase
      .from('paiements')
      .select('*, quittance:quittances(id, numero_document, type)')
      .eq('bail_id', id)
      .order('periode_debut', { ascending: false })
      .limit(24),
    supabase
      .from('v_impayes')
      .select('*')
      .eq('bail_id', id)
      .order('periode_debut', { ascending: true }),
  ])

  const logement = Array.isArray(bail.logement) ? bail.logement[0] : bail.logement
  const locataire = Array.isArray(bail.locataire) ? bail.locataire[0] : bail.locataire
  const listePaiements = paiements ?? []
  const listeImpayes = (impayes ?? []) as Impaye[]

  return (
    <div className="space-y-2xl">
      <div>
        <Link href="/app/baux" className="text-body-sm text-mute hover:text-ink">
          ← Tous les baux
        </Link>

        <div className="mt-lg flex flex-wrap items-start justify-between gap-lg">
          <div className="flex items-center gap-lg">
            <AvatarPeep
              id={locataire?.id ?? bail.locataire_id}
              avatar={locataire?.avatar}
              nom={locataire?.nom}
              taille={56}
            />
            <div>
              <h1 className="text-display-md font-extrabold tracking-tight text-ink">
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
            <Link href={`/app/baux/${id}/modifier`} className="btn btn-tertiary btn-sm">
              Modifier
            </Link>
            {bail.statut === 'Actif' ? (
              <Link
                href={`/app/paiements/nouveau?bail=${id}`}
                className="btn btn-primary btn-sm"
              >
                Enregistrer un paiement
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Caractéristiques ───────────────────────────────────────────── */}
      <section className="grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
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
        <Fiche libelle="Téléphone locataire" valeur={locataire?.telephone ?? '—'} />
      </section>

      {/* ── Impayés du bail ────────────────────────────────────────────── */}
      {listeImpayes.length > 0 ? (
        <section>
          <h2 className="mb-lg text-display-sm font-semibold tracking-tight text-ink">
            Loyers en retard sur ce bail
          </h2>
          <div className="space-y-md">
            {listeImpayes.map((impaye) => (
              <div
                key={impaye.periode_debut}
                className="flex flex-wrap items-center justify-between gap-md rounded-lg border border-hairline border-l-4 border-l-negative bg-surface-card p-lg"
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
                  <Link href="/app/impayes" className="btn btn-primary btn-sm">
                    Relancer
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Historique ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-lg text-display-sm font-semibold tracking-tight text-ink">
          Historique des paiements
        </h2>

        {listePaiements.length === 0 ? (
          <EtatVide
            icone={<Illustration nom="reflexion" taille={200} decorative />}
            titre="Aucun paiement sur ce bail"
            description="Le premier paiement enregistré générera automatiquement une quittance."
            action={
              <Link href={`/app/paiements/nouveau?bail=${id}`} className="btn btn-primary">
                Enregistrer un paiement
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-hairline">
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
                {listePaiements.map((paiement) => {
                  const quittance = Array.isArray(paiement.quittance)
                    ? paiement.quittance[0]
                    : paiement.quittance

                  return (
                    <tr key={paiement.id}>
                      <td className="font-semibold">
                        {formaterPeriode(paiement.periode_debut)}
                      </td>
                      <td>{formaterDateCourte(paiement.date_paiement)}</td>
                      <td className="hidden sm:table-cell">{paiement.mode_paiement}</td>
                      <td>
                        {paiement.statut === 'Validé' ? (
                          <Badge ton={paiement.est_partiel ? 'warning' : 'positive'}>
                            {paiement.est_partiel ? 'Partiel' : 'Payé'}
                          </Badge>
                        ) : (
                          <Badge ton="warning">Brouillon</Badge>
                        )}
                      </td>
                      <td className="text-right font-semibold tabular">
                        {formaterFCFA(paiement.montant)}
                      </td>
                      <td className="text-right">
                        {quittance ? (
                          <Link
                            href={`/app/quittances/${quittance.id}`}
                            className="font-semibold text-ink underline"
                          >
                            {quittance.type}
                          </Link>
                        ) : (
                          <Link
                            href={`/app/paiements/${paiement.id}/confirmer`}
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
          </div>
        )}
      </section>

      {/* ── Zone sensible ──────────────────────────────────────────────── */}
      <section className="card">
        <h2 className="text-display-xs font-semibold text-ink">Cycle de vie du bail</h2>
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

          <ActionConfirmee
            action={supprimerBail.bind(null, id)}
            libelle="Supprimer le bail"
            titreConfirmation="Supprimer ce bail définitivement ?"
            messageConfirmation="Action irréversible. Elle échouera si des paiements y sont rattachés — dans ce cas, préférez la résiliation."
            libelleConfirmation="Supprimer définitivement"
          />
        </div>
      </section>
    </div>
  )
}

function Fiche({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="card">
      <p className="text-body-sm text-mute">{libelle}</p>
      <p className="mt-xs text-body-md font-semibold tabular text-ink">{valeur}</p>
    </div>
  )
}
