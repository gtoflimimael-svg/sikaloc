import type { Metadata } from 'next'
import Link from 'next/link'

import { Illustration } from '@/components/ui/illustration'
import { Badge, EnTetePage, EtatVide } from '@/components/ui/retours'
import {
  formaterDateCourte,
  formaterFCFA,
  formaterPeriode,
} from '@/lib/format'
import { bailleurOnboarde } from '@/lib/session'
import { creerClientServeur } from '@/lib/supabase/serveur'

export const metadata: Metadata = { title: 'Historique des paiements' }

export default async function PageHistoriquePaiements({
  searchParams,
}: {
  searchParams: Promise<{ bail?: string; statut?: string }>
}) {
  await bailleurOnboarde()
  const { bail: bailFiltre, statut } = await searchParams
  const supabase = await creerClientServeur()

  let requete = supabase
    .from('paiements')
    .select(
      '*, bail:baux(id, locataire:locataires(nom), logement:logements(adresse)), quittance:quittances(id, numero_document, type)',
    )
    .order('date_paiement', { ascending: false })
    .limit(200)

  if (bailFiltre) requete = requete.eq('bail_id', bailFiltre)
  if (statut === 'Brouillon' || statut === 'Validé') requete = requete.eq('statut', statut)

  const [{ data: paiements }, { data: baux }] = await Promise.all([
    requete,
    supabase
      .from('baux')
      .select('id, locataire:locataires(nom), logement:logements(adresse)')
      .order('created_at', { ascending: false }),
  ])

  const liste = paiements ?? []
  const total = liste
    .filter((p) => p.statut === 'Validé')
    .reduce((somme, p) => somme + Number(p.montant), 0)

  return (
    <div>
      <EnTetePage
        titre="Historique des paiements"
        description="Tous les encaissements enregistrés, du plus récent au plus ancien."
        action={
          <Link href="/app/paiements/nouveau" className="btn btn-primary">
            Nouveau paiement
          </Link>
        }
      />

      {/* ── Filtres ────────────────────────────────────────────────────── */}
      <form method="get" className="mb-xl grid gap-md sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="bail" className="field-label">
            Bail
          </label>
          <select id="bail" name="bail" defaultValue={bailFiltre ?? ''} className="input">
            <option value="">Tous les baux</option>
            {(baux ?? []).map((b) => {
              const locataire = Array.isArray(b.locataire) ? b.locataire[0] : b.locataire
              const logement = Array.isArray(b.logement) ? b.logement[0] : b.logement

              return (
                <option key={b.id} value={b.id}>
                  {locataire?.nom ?? 'Locataire'} — {logement?.adresse ?? 'logement'}
                </option>
              )
            })}
          </select>
        </div>

        <div>
          <label htmlFor="statut" className="field-label">
            Statut
          </label>
          <select id="statut" name="statut" defaultValue={statut ?? ''} className="input">
            <option value="">Tous</option>
            <option value="Validé">Validés</option>
            <option value="Brouillon">Brouillons</option>
          </select>
        </div>

        <div className="flex items-end gap-sm">
          <button type="submit" className="btn btn-tertiary">
            Filtrer
          </button>
          {bailFiltre || statut ? (
            <Link href="/app/paiements" className="btn btn-secondary">
              Réinitialiser
            </Link>
          ) : null}
        </div>
      </form>

      {liste.length === 0 ? (
        <EtatVide
          icone={<Illustration nom="courses" taille={200} decorative />}
          titre="Aucun paiement"
          description="Les paiements enregistrés apparaîtront ici, avec leur quittance."
          action={
            <Link href="/app/paiements/nouveau" className="btn btn-primary">
              Enregistrer un paiement
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-lg flex flex-wrap items-baseline gap-sm text-body-sm text-mute">
            <span>
              {liste.length} paiement{liste.length > 1 ? 's' : ''}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Total validé :{' '}
              <strong className="font-semibold tabular text-ink">{formaterFCFA(total)}</strong>
            </span>
          </div>

          <div className="table-defilante">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Locataire</th>
                  <th scope="col">Période</th>
                  <th scope="col" className="hidden sm:table-cell">
                    Date
                  </th>
                  <th scope="col" className="hidden lg:table-cell">
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
                {liste.map((paiement) => {
                  const bail = Array.isArray(paiement.bail) ? paiement.bail[0] : paiement.bail
                  const locataire = Array.isArray(bail?.locataire)
                    ? bail?.locataire[0]
                    : bail?.locataire
                  const quittance = Array.isArray(paiement.quittance)
                    ? paiement.quittance[0]
                    : paiement.quittance

                  return (
                    <tr key={paiement.id}>
                      <td className="font-semibold">{locataire?.nom ?? '—'}</td>
                      <td>{formaterPeriode(paiement.periode_debut)}</td>
                      <td className="hidden sm:table-cell">
                        {formaterDateCourte(paiement.date_paiement)}
                      </td>
                      <td className="hidden lg:table-cell">{paiement.mode_paiement}</td>
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
                            className="font-semibold text-warning-deep underline"
                          >
                            À confirmer
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
